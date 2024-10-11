import { Box, Button, CssBaseline, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useMediaQuery, useTheme } from "@mui/material";
import { ChatInput, Dial, Disclaimer, DrawerMenu, FeedbackForm, TopMenu } from "../components";
import ChatMessagesContainer from "../containers/ChatMessagesContainer";
import { t } from "i18next";
import { useEffect, useRef, useState } from "react";
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
import { TutorialBubble } from "../components/TutorialBubble";
import { bookReservation } from "../api/api";
import { allowedToolsSet } from '../allowedTools';

interface MainScreenProps {
    userData: {
        accessToken: string;
        graphData: any;
        profilePictureURL: string;
    };
}

const MainScreen = ({userData}: MainScreenProps) => {
    const defaultEnabledTools: { [key: string]: boolean } = {};
    allowedToolsSet.forEach((tool) => {
        defaultEnabledTools[tool] = true;
    });

    const defaultModel = "gpt-4o";
    const defaultChatHistory = {
        "chatItems": [],
        "description": "",
        "uuid": "",
        "enabledTools": defaultEnabledTools,
        "model": defaultModel
    }

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [maxMessagesSent] = useState<number>(10);
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [openDrawer, setOpenDrawer] = useState<boolean>(false);
    const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isGoodResponse, setIsGoodResponse] = useState(false);
    const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
    const [currentChatHistory, setCurrentChatHistory] = useState<ChatHistory>(defaultChatHistory);
    const [chatHistoriesDescriptions, setChatHistoriesDescriptions] = useState<string[]>(["Conversation 1"]);
    const [chatIndexToLoadOrDelete, setChatIndexToLoadOrDelete] = useState<number | null>(null);
    const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);
    const [warningDialogMessage, setWarningDialogMessage] = useState("");
    const [quotedText, setQuotedText] = useState<string>();
    const [showTutorials, setShowTutorials] = useState(false);
    const [tutorialBubbleNumber, setTutorialBubbleNumber] = useState<number | undefined>(undefined);

    const menuIconRef = useRef<HTMLButtonElement>(null);
    const theme = useTheme();
    const {instance, inProgress} = useMsal();
    const isAuthenticated = useIsAuthenticated();
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

            setCurrentChatHistory((prevChatHistory) => {
                const updatedChatItems = prevChatHistory?.chatItems.map((item, itemIndex) => {
                    if (itemIndex === prevChatHistory.chatItems.length - 1 && isACompletion(item)) {
                        return {
                            ...item,
                            message: {
                                ...item.message,
                                context: completionResponse.message.context,
                                tools_info: completionResponse.message.tools_info
                            }
                        };
                    }
                    return item;
                });

                const updatedChatHistory: ChatHistory = {
                    ...prevChatHistory,
                    chatItems: updatedChatItems
                };

                // filters toast messages so they're not saved to local storage
                const filteredChatHistory = {
                    ...updatedChatHistory,
                    chatItems: updatedChatItems.filter(item => !isAToastMessage(item))
                }

                saveChatHistories(filteredChatHistory);
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

            setCurrentChatHistory((prevChatHistory) => {
                const updatedChatHistory = {
                    ...prevChatHistory,
                    chatItems: [...prevChatHistory.chatItems, toast]
                };
                return updatedChatHistory;
            });

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
            ...currentChatHistory.chatItems,
            userMessage,
        ]);

        // prepare request bundle
        const request: MessageRequest = {
            messages: messages,
            max: maxMessagesSent,
            top: 5,
            tools: (Object.keys(currentChatHistory.enabledTools)).filter((key) => currentChatHistory.enabledTools[key]),
            uuid: currentChatHistory.uuid,
            quotedText: messagedQuoted,
            model: currentChatHistory.model,
            fullName: userData.graphData['givenName'] + ' ' + userData.graphData['surname']
        };

        // update current chat window with the message sent..
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: [...prevChatHistory.chatItems, userMessage, responsePlaceholder],
            };
            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });

        sendApiRequest(request);
        setQuotedText(undefined);
    };

    const handleFeedbackSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsFeedbackVisible(false);
        let toast: ToastMessage;

        try {
          await sendFeedback(feedback, isGoodResponse, currentChatHistory.uuid);
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

        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: [...prevChatHistory.chatItems, toast]
            };

            return updatedChatHistory;
        });

        setFeedback('');
    };

    const updateLastMessage = (message_chunk: string) => {
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatItems = prevChatHistory?.chatItems.map((item, itemIndex) => {
                if (itemIndex === prevChatHistory.chatItems.length - 1 && isACompletion(item)) {
                    return {
                        ...item,
                        message: {
                            ...item.message,
                            content: message_chunk,
                        }
                    };
                }
                return item;
            });

            const updatedChatHistory: ChatHistory = {
                ...prevChatHistory,
                chatItems: updatedChatItems
            };

            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });
    };

    const replayChat = () => {
        const currentChatHistoryItems = currentChatHistory.chatItems;
        const lastQuestion = currentChatHistoryItems[currentChatHistoryItems.length - 2];

        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: prevChatHistory.chatItems.slice(0, prevChatHistory.chatItems.length - 2)
            };

            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });

        if (isAMessage(lastQuestion)) {
          makeApiRequest(lastQuestion.content ? lastQuestion.content : "", lastQuestion.quotedText);
        }
    };

    const loadChatHistoriesFromStorage = () => {
        const chatHistories = localStorage.getItem("chatHistories");
        if (chatHistories) {
            const parsedChatHistories = JSON.parse(chatHistories) as ChatHistory[];
            setCurrentChatHistory(parsedChatHistories[0]);
            setChatHistoriesDescriptions(parsedChatHistories.map((chatHistory, index) => chatHistory.description || "Conversation " + (index + 1)));
        }
    };

    const handleClearChat = () => {
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: []
            };
            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        })
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

        if (!currentChatHistory.uuid) {
            currentChatHistory.uuid = uuidv4();
        }

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

        // update current chat window with the message sent..
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: [responsePlaceholder]
            };
            return updatedChatHistory;
        });

        // prepare request bundle
        const request: MessageRequest = {
          messages: messages,
          max: maxMessagesSent,
          top: 5,
          tools: [],
          uuid: currentChatHistory.uuid,
          model: currentChatHistory.model
        };

        sendApiRequest(request);
    }

    // Effect for setting the welcome message whenever the current chat is empty
    useEffect(() => {
        if (isAuthenticated && userData.graphData && inProgress === InteractionStatus.None &&
            currentChatHistory.chatItems.length === 0) {
            setWelcomeMessage(userData.graphData);
        }
    }, [isAuthenticated, userData.graphData, inProgress, currentChatHistory.chatItems.length]);

    useEffect(() => {
        // Set the `lang` attribute whenever the language changes
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    // Scrolls the last updated message (if its streaming, or once done) into view
    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({behavior: "smooth",});
    }, [currentChatHistory.chatItems]);

    // Load chat histories if present
    useEffect(() => {
        loadChatHistoriesFromStorage();
    }, []);

    const handleRemoveToastMessage = (indexToRemove: number) => {
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: prevChatHistory.chatItems.filter((_, itemIndex) => itemIndex !== indexToRemove)
            }

            return updatedChatHistory;
        });
    };

    const saveChatHistories = (updatedChatHistory: ChatHistory) => {
        try {
            const chatHistories = JSON.parse(localStorage.getItem("chatHistories") || "[]") as ChatHistory[];
            chatHistories[currentChatIndex] = updatedChatHistory;
            localStorage.setItem("chatHistories", JSON.stringify(chatHistories));
        } catch (error) {
            if (error instanceof DOMException && error.name === "QuotaExceededError") {
                console.error("LocalStorage is full:", error);
                setWarningDialogMessage(t("storage.full"))
            }
            console.error("Failed to save to localStorage:", error);
        }
    }

    const handleUpdateEnabledTools = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;

        setCurrentChatHistory((prevChatHistory) => {
            const updatedTools = {
                ...prevChatHistory.enabledTools,
                [name]: checked
            };

            const updatedChatHistory = {
                ...prevChatHistory,
                enabledTools: updatedTools
            }

            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        })
    };

    const handleAddQuotedText = (quotedText: string) => {
        setQuotedText(quotedText);
    };

    const handleRemoveQuote = () => {
        setQuotedText(undefined);
    };

    const hanldeUpdateModelVersion = (modelName: string) => {
        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                model: modelName
            }
            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });
    };

    useEffect(() => {
        const hasSeenTutorials = localStorage.getItem("hasSeenTutorials");
        if (hasSeenTutorials !== "true" && displayIsAtleastSm) {
            setShowTutorials(true);
        }
    }, []);

    const handleUpdateTutorialBubbleNumber = (tipNumber: number | undefined) => {
        setTutorialBubbleNumber(tipNumber);
    };

    const toggleTutorials = (showTutorials?: boolean) => {
        if (showTutorials) {
            setOpenDrawer(false);
            setShowTutorials(true);
        } else {
            localStorage.setItem("hasSeenTutorials", "true");
            setShowTutorials(false);
        }
    };

    const handleDeleteSavedChat = (index: number) => {
        setChatIndexToLoadOrDelete(index);
        setShowDeleteChatDialog(true);
    };

    const deleteSavedChat = () => {
        setShowDeleteChatDialog(false);
        if (chatIndexToLoadOrDelete !== null) {
            const chatHistories = JSON.parse(localStorage.getItem("chatHistories") || "[]") as ChatHistory[];
            const updatedChatHistories = [
                ...chatHistories.slice(0, chatIndexToLoadOrDelete),
                ...chatHistories.slice(chatIndexToLoadOrDelete + 1)
            ];

            if (updatedChatHistories.length === 0) {
                // current chat was only chat and at index 0, so just reset state
                setOpenDrawer(false);
                setCurrentChatHistory(defaultChatHistory);
            } else if (currentChatIndex === chatIndexToLoadOrDelete) {
                // deleting current chat, so set to whatever is at index 0
                setCurrentChatHistory(updatedChatHistories[0]);
                setCurrentChatIndex(0);
            } else if (chatIndexToLoadOrDelete < currentChatIndex) {
                // deleted chat is at a lower index, so re-index current chat
                setCurrentChatIndex(currentChatIndex - 1);
            }

            if (updatedChatHistories.length === 0) {
                setChatHistoriesDescriptions(["Conversation 1"]);
            } else {
                setChatHistoriesDescriptions(updatedChatHistories.map((chatHistory, index) => chatHistory.description || "Conversation " + (index + 1)));
            }

            setChatIndexToLoadOrDelete(null);
            localStorage.setItem("chatHistories", JSON.stringify(updatedChatHistories));
        }
    };

    const handleCancelDeleteSavedChat = () => {
        setShowDeleteChatDialog(false);
        setChatIndexToLoadOrDelete(null);
    };

    const handleLoadSavedChat = (index: number) => {
        const chatHistories = JSON.parse(localStorage.getItem("chatHistories") || "[]") as ChatHistory[];
        if (chatHistories) {
            const newChat = chatHistories[index];
            setCurrentChatHistory(newChat);
            setCurrentChatIndex(index);
        }
    };

    const handleNewChat = () => {
        const chatHistories = JSON.parse(localStorage.getItem("chatHistories") || "[]") as ChatHistory[];
        if (chatHistories.length === 10) {
            setWarningDialogMessage(t("chat.history.full"));
        } else {
            const newChatIndex = chatHistories.length;
            setCurrentChatIndex(newChatIndex);
            setCurrentChatHistory(defaultChatHistory);
            setChatHistoriesDescriptions([...chatHistoriesDescriptions, "Conversation " + (chatHistoriesDescriptions.length + 1)]);
            setOpenDrawer(false);
        }
    }

    const renameChat = (newDescription: string, indexToUpdate: number) => {
        const chatHistories = JSON.parse(localStorage.getItem("chatHistories") || "[]") as ChatHistory[];
        const updatedChatHistories = [...chatHistories];
        const updatedChatHistory: ChatHistory = {
            ...chatHistories[indexToUpdate],
            description: newDescription
        };
        updatedChatHistories[indexToUpdate] = updatedChatHistory;
        localStorage.setItem("chatHistories", JSON.stringify(updatedChatHistories));
        if (currentChatIndex === indexToUpdate) {
            setCurrentChatHistory(updatedChatHistory);
        }
        setChatHistoriesDescriptions(updatedChatHistories.map((chatHistory, index) => chatHistory.description || "Conversation " + (index + 1)));
    }

    const handleBookReservation = async (bookingDetails: BookingConfirmation) => {
        let toast: ToastMessage;
        try {
            await bookReservation(bookingDetails);
            toast = {
                toastMessage: `${t("booking.success")} ${bookingDetails.startDate}`,
                isError: false
            };
        } catch (error) {
           toast = {
                toastMessage: `${t("booking.fail")} ${error}`,
                isError: true
            };
        }

        setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: [...prevChatHistory.chatItems, toast],
            };
            saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });
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
                    chatHistory={currentChatHistory}
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
                        selectedModel ={currentChatHistory.model}
                    />
                </Box>
            </Box>
            <Dial
                drawerVisible={openDrawer || (tutorialBubbleNumber !== undefined && tutorialBubbleNumber > 1)}
                onNewChat={handleNewChat}
                onClearChat={handleClearChat}
            />
            <Disclaimer />
            <DrawerMenu
                openDrawer={openDrawer || (tutorialBubbleNumber !== undefined && tutorialBubbleNumber > 1)}
                chatDescriptions={chatHistoriesDescriptions}
                currentChatIndex={currentChatIndex}
                toggleDrawer={setOpenDrawer}
                onClearChat={handleClearChat}
                onNewChat={handleNewChat}
                setLangCookie={setLangCookie}
                logout={handleLogout}
                enabledTools={currentChatHistory.enabledTools}
                handleUpdateEnabledTools={handleUpdateEnabledTools}
                selectedModel ={currentChatHistory.model}
                handleSelectedModelChanged={hanldeUpdateModelVersion}
                tutorialBubbleNumber={tutorialBubbleNumber}
                handleToggleTutorials={toggleTutorials}
                handleDeleteSavedChat={handleDeleteSavedChat}
                handleLoadSavedChat={handleLoadSavedChat}
                renameChat={renameChat}
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

            {showDeleteChatDialog &&
                <Dialog
                    open={showDeleteChatDialog}
                    onClose={handleCancelDeleteSavedChat}
                >
                    <DialogTitle>{t("delete.conversation.title")}</DialogTitle>
                    <DialogContent>
                       <DialogContentText>
                            {t("delete.conversation.content")}
                        </DialogContentText>
                    </DialogContent>
                    <DialogActions sx={{display: 'flex', justifyContent: 'flex-start'}}>
                        <Button onClick={handleCancelDeleteSavedChat} sx={{backgroundColor: 'primary.main', color: 'white', width: '100px', margin: '5px 15px'}}>
                            {t("cancel")}
                        </Button>
                        <Button onClick={deleteSavedChat} sx={{backgroundColor: '#C43831', color: 'white', width: '100px'}}>
                            {t("delete")}
                        </Button>
                    </DialogActions>
                </Dialog>
            }

            {warningDialogMessage &&
                <Dialog
                    open={Boolean(warningDialogMessage)}
                    onClose={() => setWarningDialogMessage("")}
                >
                    <DialogContent>
                        {warningDialogMessage}
                    </DialogContent>
                </Dialog>
            }
        </>
    )
}

export default MainScreen;