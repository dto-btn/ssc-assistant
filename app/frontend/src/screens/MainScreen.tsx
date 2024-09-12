import { Box, CssBaseline, useMediaQuery, useTheme } from "@mui/material";
import { ChatInput, Dial, Disclaimer, DrawerMenu, FeedbackForm, TopMenu } from "../components";
import ChatMessagesContainer from "../containers/ChatMessagesContainer";
import { t } from "i18next";
import { useCallback, useEffect, useRef, useState } from "react";
import i18n from "../i18n";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { isACompletion, isAMessage, isAToastMessage } from "../utils";
import { isTokenExpired } from "../util/token";
import { completionMySSC, sendFeedback } from "../api/api";
import { loginRequest } from "../authConfig";
import { AccountInfo, InteractionStatus } from "@azure/msal-browser";
import Cookies from "js-cookie";
import { v4 as uuidv4 } from 'uuid';
import QuoteTextTooltip from "../components/QuoteTextTooltip";
import { bookReservation } from "../api/api";
import { TutorialBubble } from "../components/TutorialBubble";

interface MainScreenProps {
    userData: {
        accessToken: string;
        graphData: any; 
        profilePictureURL: string;
    };
}

const MainScreen = ({userData}: MainScreenProps) => {
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [maxMessagesSent] = useState<number>(10);
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [openDrawer, setOpenDrawer] = useState<boolean>(false);
    const [uuid, setUuid] = useState<string>(uuidv4());
    const {instance, inProgress} = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isGoodResponse, setIsGoodResponse] = useState(false);
    const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
    const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
        "geds": true,
        "corporate": true,
        "archibus": true
    })
    const [selectedModel, setSelectedModel] = useState<string>("gpt-4o")
    const [quotedText, setQuotedText] = useState<string>();
    const [showTutorials, setShowTutorials] = useState(false);
    const menuIconRef = useRef<HTMLButtonElement>(null);
    const [tutorialBubbleNumber, setTutorialBubbleNumber] = useState<number | undefined>(undefined);
    const theme = useTheme();
    const displayIsAtleastSm = useMediaQuery(theme.breakpoints.up('sm'));

    const convertChatHistoryToMessages = (chatHistory: ChatItem[]) : Message[] => {
        const startIndex = Math.max(chatHistory.length - maxMessagesSent, 0);
        return chatHistory.slice(startIndex).map(
          (chatItem) => {
            if (isACompletion(chatItem)) {
              return {
                role: chatItem.message.role,
                content: chatItem.message.content,
              };
            }
            if (isAMessage(chatItem)) {
              return chatItem;
            }
            return undefined;
        }).filter(message => message !== undefined) as Message[];
    };
    
    const sendApiRequest = async (request: MessageRequest) => {
        try {
            /**
             * TODO: API call should be made with an accessToken to respect the auth flow,
             *       however in this case, we do not have the luxury to modify our service provider config.
             *       We at least send the idToken to decode and validate it on our API to ensure we log
             *       proper user.
             */
            let idToken = instance.getActiveAccount()?.idToken;
            const expired = isTokenExpired(idToken);

            if(expired){
            const response = await instance.acquireTokenSilent({
                ...loginRequest,
                account: instance.getActiveAccount() as AccountInfo,
                forceRefresh: true
            });
            idToken = response.idToken;
            }

            if (!idToken)
            throw new Error(t("no.id.token"));

            const completionResponse = await completionMySSC({
            request: request,
            updateLastMessage: updateLastMessage,
            accessToken: idToken
            });

            console.log(completionResponse)

            setChatHistory((prevChatHistory) => {
            const updatedChatHistory = [...prevChatHistory]; //making a copy
            const lastItemIndex = updatedChatHistory.length - 1;
            const lastItem = updatedChatHistory[lastItemIndex];

            if (isACompletion(lastItem)) {
                updatedChatHistory[lastItemIndex] = {
                ...lastItem,
                    message: {
                    ...lastItem.message,
                    context: completionResponse.message.context,
                    tools_info: completionResponse.message.tools_info
                    }
                }
            }

            saveChatHistory(updatedChatHistory); // Save chat history to local storage
            return updatedChatHistory;
            });

        } catch (error) {
            let errorMessage: string;
            if (error instanceof Error) {
            errorMessage = error.message;
            } else {
            errorMessage = t("chat.unknownError");
            }
            const toast : ToastMessage = {
            toastMessage: errorMessage,
            isError: true
            }
            setChatHistory(prevChatHistory => [...prevChatHistory, toast]);

        } finally {
            setIsLoading(false);
        }
    }

    const makeApiRequest = async (question: string, quotedTextFromRegenerate?: string) => {
        // set is loading so we disable some interactive functionality while we load the response
        setIsLoading(true);
        const messagedQuoted = quotedTextFromRegenerate ? quotedTextFromRegenerate : quotedText;

        const userMessage: Message = {
            role: "user",
            content: question,
            quotedText: messagedQuoted
        };

        const responsePlaceholder: Completion = {
            message: {
            role: "assistant",
            content: "",
            }
        };

        const messages = convertChatHistoryToMessages([
            ...chatHistory,
            userMessage,
        ]);

        // prepare request bundle
        const request: MessageRequest = {
            messages: messages,
            max: maxMessagesSent,
            top: 5,
            tools: (Object.keys(enabledTools)).filter((key) => enabledTools[key]),
            uuid: uuid,
            quotedText: messagedQuoted,
            model: selectedModel,
            fullName: userData.graphData['givenName'] + ' ' + userData.graphData['surname']
        };

        //update current chat window with the message sent..
        setChatHistory((prevChatHistory) => {
            const updatedChatHistory = [
            ...prevChatHistory,
            userMessage,
            responsePlaceholder,
            ];
            saveChatHistory(updatedChatHistory); // Save chat history to local storage
            return updatedChatHistory;
        });

        sendApiRequest(request);
        setQuotedText(undefined)
    };

    const handleFeedbackSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsFeedbackVisible(false);
        let toast: ToastMessage;
    
        try {
          await sendFeedback(feedback, isGoodResponse, uuid);
          toast = {
            toastMessage: t("feedback.success"),
            isError: false
          };
        } catch (error) {
          toast = {
            toastMessage: t("feedback.fail"),
            isError: true
          };
        }
    
        setChatHistory(prevChatHistory => [...prevChatHistory, toast]);
        setFeedback('');
    };

    const updateLastMessage = (message_chunk: string) => {
        setChatHistory((prevChatHistory) => {
          const updatedChatHistory = [...prevChatHistory]; //making a copy
          const lastItemIndex = updatedChatHistory.length - 1;
          const lastItem = updatedChatHistory[lastItemIndex];

          if (isACompletion(lastItem)) {
            updatedChatHistory[lastItemIndex] = {
              ...lastItem,
              message: {
                ...lastItem.message,
                content: message_chunk
              }
            }
          }
          return updatedChatHistory;
        });
    };

    const replayChat = () => {
        const lastQuestion = chatHistory[chatHistory.length - 2];
        setChatHistory(chatHistory => chatHistory.slice(0, chatHistory.length - 2));
        if (isAMessage(lastQuestion)) {
          makeApiRequest(lastQuestion.content ? lastQuestion.content : "", lastQuestion.quotedText);
        }
    };
    
    const saveChatHistory = (chatHistory: ChatItem[]) => {
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory.filter(item => !isAToastMessage(item))));
    };

      // This function will be used to load the chat history from localStorage
    const loadChatHistoryAndSettings = () => {
        const savedChatHistory = localStorage.getItem("chatHistory");
        const enabledToolHistory = localStorage.getItem("enabledTools");
        const selectedModelHistory = localStorage.getItem("selectedModel");

        if (savedChatHistory) {
            setChatHistory(JSON.parse(savedChatHistory));
        }
        if (enabledToolHistory) {
            setEnabledTools(JSON.parse(enabledToolHistory));
        }
        if (selectedModelHistory) {
            setSelectedModel(JSON.parse(selectedModelHistory));
        }
    };

    const handleClearChat = () => {
        localStorage.removeItem("chatHistory"); // Clear chat history from local storage
        setWelcomeMessage(userData.graphData);
        setUuid(uuidv4());
        setOpenDrawer(false);
    };
    
    const setLangCookie = () => {
        Cookies.set("lang_setting", i18n.language, {
          expires: 30,
        });
        setOpenDrawer(false);
    };
    
    const handleLogout = () => {
        instance.logoutRedirect({
          postLogoutRedirectUri: "/",
        });
    };
    
    const setWelcomeMessage = async (graphData: any) => {
        setIsLoading(true);
    
        const systemMessage: Message = {
          role: "system",
          content: t("welcome.prompt.system")
        };
    
        const welcomeMessageRequest: Message = {
          role: "user",
          content: t("welcome.prompt.user", {givenName: graphData['givenName']})
        };
    
        const messages = [systemMessage, welcomeMessageRequest];
        const responsePlaceholder: Completion = {
            message: {
            role: "assistant",
            content: "",
            },
        };
    
        //update current chat window with the message sent..
        setChatHistory([responsePlaceholder]);
    
        // prepare request bundle
        const request: MessageRequest = {
          messages: messages,
          max: maxMessagesSent,
          top: 5,
          tools: [],
          uuid: uuid,
          model: selectedModel
        };
    
        sendApiRequest(request);
    }

    // Effect for setting the welcome message
    useEffect(() => {
        if (isAuthenticated && userData.graphData && inProgress === InteractionStatus.None && chatHistory.length === 0) {
        setWelcomeMessage(userData.graphData);
        }
    }, [isAuthenticated, userData.graphData, inProgress, chatHistory.length]);

    useEffect(() => {
        // Set the `lang` attribute whenever the language changes
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    // Scrolls the last updated message (if its streaming, or once done) into view
    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({behavior: "smooth",});
    }, [chatHistory[chatHistory.length - 1]]);

    // Load chat history if present
    useEffect(() => {
        loadChatHistoryAndSettings();
    }, []);

    const handleRemoveToastMessage = useCallback((indexToRemove: number) => {
        setChatHistory(prevChatHistory => {
        return prevChatHistory.filter((_item, index) => index !== indexToRemove);
        });
    }, []);

    const saveToolSelection = (enabledTools: Record<string, boolean>) => {
        localStorage.setItem("enabledTools", JSON.stringify(enabledTools));
    }

    // Update localStorage with new enabledTools
    useEffect(() => {
        saveToolSelection(enabledTools);
    }, [enabledTools]); 

    const handleUpdateEnabledTools = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEnabledTools({
        ...enabledTools,
        [event.target.name]: event.target.checked
        });
    };

    const handleAddQuotedText = (quotedText: string) => {
        setQuotedText(quotedText);
    };

    const handleRemoveQuote = () => {
        setQuotedText(undefined);
    };

    const hanldeUpdateModelVersion = (modelName: string) => {
        setSelectedModel(modelName);
        localStorage.setItem("selectedModel", JSON.stringify(modelName));
    };

    useEffect(() => {
        const hasSeenTutorials = localStorage.getItem("hasSeenTutorials");
        if (hasSeenTutorials !== "true" && displayIsAtleastSm) {
            setShowTutorials(true);
        }
    }, [])

    const handleUpdateTutorialBubbleNumber = (tipNumber: number | undefined) => {
        setTutorialBubbleNumber(tipNumber);
    }

    const toggleTutorials = (showTutorials?: boolean) => {
        if (showTutorials) {
            setOpenDrawer(false);
            setShowTutorials(true);
        } else {
            localStorage.setItem("hasSeenTutorials", "true");
            setShowTutorials(false);
        }        
    }

    const handleBookReservation = async (bookingDetails: BookingConfirmation) => {
        try {
            await bookReservation(bookingDetails);
            const bookingSuccessfulToast: ToastMessage = {
                toastMessage: `${t("booking.success")} ${bookingDetails.startDate}`,
                isError: false
            };
            setChatHistory(prevChatHistory => [...prevChatHistory, bookingSuccessfulToast]);
        } catch (error) {
           const bookingFailedToast: ToastMessage = {
                toastMessage: `${t("booking.fail")} ${error}`,
                isError: true
            };
            setChatHistory(prevChatHistory => [...prevChatHistory, bookingFailedToast]);
        }
    }
    
    return (
        <>
            <CssBaseline />
            <TopMenu toggleDrawer={setOpenDrawer} ref={menuIconRef}  />
            <Box
                sx={{
                display: "flex",
                flexFlow: "column",
                minHeight: "100vh",
                margin: "auto",
                }}
                maxWidth="lg"
            >
                <Box sx={{ flexGrow: 1 }}></Box>
                <QuoteTextTooltip addQuotedText={handleAddQuotedText}/>
                <ChatMessagesContainer 
                    chatHistory={chatHistory}
                    isLoading={isLoading}
                    chatMessageStreamEnd={chatMessageStreamEnd}
                    replayChat={replayChat}
                    setIsFeedbackVisible={setIsFeedbackVisible}
                    setIsGoodResponse={setIsGoodResponse}
                    handleRemoveToastMessage={handleRemoveToastMessage}
                    handleBookReservation={handleBookReservation}
                />
                <div ref={chatMessageStreamEnd} style={{ height: '50px' }} />
                <Box
                    sx={{
                        position: "sticky",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 1100,
                        bgcolor: "background.default",
                        padding: "1rem",
                    }}
                >
                    <ChatInput
                        clearOnSend
                        placeholder={t("placeholder")}
                        disabled={isLoading}
                        onSend={(question) => makeApiRequest(question)}
                        quotedText={quotedText}
                        handleRemoveQuote={handleRemoveQuote}
                        selectedModel={selectedModel}
                    />
                </Box>
            </Box>
            <Dial 
                drawerVisible={openDrawer || (tutorialBubbleNumber !== undefined && tutorialBubbleNumber > 1)} 
                onClearChat={handleClearChat} 
            />
            <Disclaimer />
            <DrawerMenu 
                openDrawer={openDrawer || (tutorialBubbleNumber !== undefined && tutorialBubbleNumber > 1)} 
                toggleDrawer={setOpenDrawer} 
                onClearChat={handleClearChat} 
                setLangCookie={setLangCookie} 
                logout={handleLogout}
                enabledTools={enabledTools}
                handleUpdateEnabledTools={handleUpdateEnabledTools}
                selectedModel={selectedModel}
                handleSelectedModelChanged={hanldeUpdateModelVersion}
                tutorialBubbleNumber={tutorialBubbleNumber}
                handleToggleTutorials={toggleTutorials}
            />
            <FeedbackForm
                feedback={feedback}
                setFeedback={setFeedback}
                open={isFeedbackVisible}
                handleClose={() => setIsFeedbackVisible(false)}
                handleFeedbackSubmit={handleFeedbackSubmit}
            />
            {showTutorials &&
                <TutorialBubble handleAllTutorialsDisplayed={toggleTutorials} menuIconRef={menuIconRef} updateTutorialBubbleNumber={handleUpdateTutorialBubbleNumber} />
            }
        </>
    )
}

export default MainScreen;