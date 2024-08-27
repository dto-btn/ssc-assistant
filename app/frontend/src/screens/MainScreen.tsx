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
    const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [isGoodResponse, setIsGoodResponse] = useState(false);
    const [currentChatIndex, setCurrentChatIndex] = useState<number>(0);
    const [savedChatHistories, setSavedChatHistories] = useState<ChatHistory[]>([]);
    const [chatToLoadOrDelete, setChatToLoadOrDelete] = useState<number | null>(null);
    const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);
    const [showChatHistoryFullDialog, setShowChatHistoryFullDialog] = useState(false);
    const [quotedText, setQuotedText] = useState<string>();
    const [showTutorials, setShowTutorials] = useState(false);
    const [tutorialBubbleNumber, setTutorialBubbleNumber] = useState<number | undefined>(undefined);

    const menuIconRef = useRef<HTMLButtonElement>(null);
    const theme = useTheme();
    const {instance, inProgress} = useMsal();
    const isAuthenticated = useIsAuthenticated();
    const displayIsAtleastSm = useMediaQuery(theme.breakpoints.up('sm'));
    
    const defaultEnabledTools = {
        "geds": true,
        "corporate": true,
    };
    const defaultModel = "gpt-4o";

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

            setSavedChatHistories((prevChatHistories) => {
                if (!prevChatHistories[currentChatIndex]) {
                    return prevChatHistories;
                }

                const updatedChatHistories = prevChatHistories.map((history, index) => {
                    if (index !== currentChatIndex) return history;
            
                    const updatedChatItems = history.chatItems.map((item, itemIndex) => {
                        if (itemIndex === history.chatItems.length - 1 && isACompletion(item)) {
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
                    }).filter(item => !isAToastMessage(item));
            
                    return { ...history, chatItems: updatedChatItems };
                });

                saveChatHistories(updatedChatHistories);
                return updatedChatHistories;
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

            setSavedChatHistories((prevChatHistories) => {
                if (!prevChatHistories[currentChatIndex]) { return prevChatHistories };

                const updatedChatHistories = prevChatHistories.map((history, index) =>
                    index === currentChatIndex
                        ? { ...history, chatItems: [...history.chatItems, toast] }
                        : history
                );

                return updatedChatHistories;
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
            ...savedChatHistories[currentChatIndex].chatItems,
            userMessage,
        ]);

        // prepare request bundle
        const request: MessageRequest = {
            messages: messages,
            max: maxMessagesSent,
            top: 5,
            tools: (Object.keys(savedChatHistories[currentChatIndex].enabledTools)).filter((key) => savedChatHistories[currentChatIndex].enabledTools[key]),
            uuid: savedChatHistories[currentChatIndex].uuid,
            quotedText: messagedQuoted,
            model: savedChatHistories[currentChatIndex].model
        };

        // update current chat window with the message sent..
        setSavedChatHistories((prevChatHistories) => {
            const updatedChatHistories = prevChatHistories.map((history, index) =>
                index === currentChatIndex
                    ? {
                        ...history,
                        chatItems: [
                            ...history.chatItems,
                            userMessage,
                            responsePlaceholder
                        ]
                    }
                    : history
            );

            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
        });

        sendApiRequest(request);
        setQuotedText(undefined);
    };

    const handleFeedbackSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setIsFeedbackVisible(false);
        let toast: ToastMessage;
    
        try {
          await sendFeedback(feedback, isGoodResponse, savedChatHistories[currentChatIndex].uuid);
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
    
        setSavedChatHistories((prevChatHistories) => {
            const updatedChatHistories = prevChatHistories.map((history, index) => 
                index === currentChatIndex
                    ? {
                        ...history,
                        chatItems: [
                            ...history.chatItems,
                            toast
                        ]
                    }
                    : history
            );

            return updatedChatHistories;
        });

        setFeedback('');
    };

    const updateLastMessage = (message_chunk: string) => {
        setSavedChatHistories((prevChatHistories) => {
            if (!prevChatHistories[currentChatIndex]) {
                return prevChatHistories;
            }

            const updatedChatHistories = prevChatHistories.map((history, index) => {
                if (index !== currentChatIndex) return history;
        
                const updatedChatItems = history.chatItems.map((item, itemIndex) => {
                    if (itemIndex === history.chatItems.length - 1 && isACompletion(item)) {
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
        
                return { ...history, chatItems: updatedChatItems };
            });
            saveChatHistories(updatedChatHistories); 
            return updatedChatHistories;
        });
    };

    const replayChat = () => {
        const currentChatHistoryItems = savedChatHistories[currentChatIndex].chatItems;
        const lastQuestion = currentChatHistoryItems[currentChatHistoryItems.length - 2];

        setSavedChatHistories((prevChatHistories) => {
            if (!prevChatHistories[currentChatIndex]) {
                return prevChatHistories;
            };

            const updatedChatHistories = prevChatHistories.map((history, index) => {
                if (index !== currentChatIndex) return history;

                const updatedChatItems = history.chatItems.slice(0, history.chatItems.length - 2);
                return { ...history, chatItems: updatedChatItems };
            });

            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
        });

        if (isAMessage(lastQuestion)) {
          makeApiRequest(lastQuestion.content ? lastQuestion.content : "", lastQuestion.quotedText);
        }
    };

    const loadChatHistoriesFromStorage = () => {
        const savedChatHistories = localStorage.getItem("savedChatHistories");
        if (savedChatHistories) {
            setSavedChatHistories(JSON.parse(savedChatHistories));
        }
    };

    const handleClearChat = () => {
        setSavedChatHistories((prevChatHistories) => {
            const updatedChatHistories = prevChatHistories.map((history, index) => {
                if (index !== currentChatIndex) return history;
                return { ...history, chatItems: [] };
            });
            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
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

        if (!savedChatHistories[currentChatIndex]) {
            const newuuid = uuidv4();
            savedChatHistories[currentChatIndex] = {
                "chatItems": [],
                "description": "",
                "uuid": newuuid,
                "enabledTools": defaultEnabledTools,
                "model": defaultModel
            }
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
        setSavedChatHistories((prevChatHistories) => {
            const updatedChatHistories = prevChatHistories.map((history, index) => {
                if (index !== currentChatIndex) return history;
                return { ...history, chatItems: [responsePlaceholder]}
            })
            return updatedChatHistories;
        });
    
        // prepare request bundle
        const request: MessageRequest = {
          messages: messages,
          max: maxMessagesSent,
          top: 5,
          tools: [],
          uuid: savedChatHistories[currentChatIndex].uuid,
          model: savedChatHistories[currentChatIndex].model
        };
    
        sendApiRequest(request);
    }

    // Effect for setting the welcome message whenever the current chat is empty
    useEffect(() => {
        const currentChatHistory = savedChatHistories[currentChatIndex];
        if (isAuthenticated && userData.graphData && inProgress === InteractionStatus.None && 
            (!currentChatHistory || currentChatHistory.chatItems.length === 0)) {
            setWelcomeMessage(userData.graphData);
        }
    }, [isAuthenticated, userData.graphData, inProgress, savedChatHistories[currentChatIndex]?.chatItems.length]);

    useEffect(() => {
        // Set the `lang` attribute whenever the language changes
        document.documentElement.lang = i18n.language;
    }, [i18n.language]);

    // Scrolls the last updated message (if its streaming, or once done) into view
    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({behavior: "smooth",});
    }, [savedChatHistories[currentChatIndex]?.chatItems]);

    // Load chat histories if present
    useEffect(() => {
        loadChatHistoriesFromStorage();
    }, []);

    const handleRemoveToastMessage = (indexToRemove: number) => {
        setSavedChatHistories((prevChatHistories) => {
            if (!prevChatHistories[currentChatIndex]) return prevChatHistories;
    
            const updatedChatHistories = prevChatHistories.map((history, index) =>
                index === currentChatIndex
                    ? { ...history, chatItems: history.chatItems.filter((_, itemIndex) => itemIndex !== indexToRemove) }
                    : history
            );

            return updatedChatHistories;
        });
    };

    const saveChatHistories = (updatedChatHistories: ChatHistory[]) => {
        try {
            localStorage.setItem("savedChatHistories", JSON.stringify(updatedChatHistories));
        } catch (error) {
            console.error("Failed to save to localStorage:", error);
        }
    }

    const handleUpdateEnabledTools = (event: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = event.target;

        setSavedChatHistories((prevChatHistories) => {
            if (!prevChatHistories[currentChatIndex]) return prevChatHistories;
            
            const updatedTools = {
                ...prevChatHistories[currentChatIndex].enabledTools,
                [name]: checked
            };

            const updatedChatHistories = prevChatHistories.map((history, index) =>
                index === currentChatIndex
                    ? { ...history, enabledTools: updatedTools }
                    : history
            );

            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
        })
    };

    const handleAddQuotedText = (quotedText: string) => {
        setQuotedText(quotedText);
    };

    const handleRemoveQuote = () => {
        setQuotedText(undefined);
    };

    const hanldeUpdateModelVersion = (modelName: string) => {
        setSavedChatHistories((prevChatHistories) => {
            if (!prevChatHistories[currentChatIndex]) return prevChatHistories;
            
            const updatedChatHistories = prevChatHistories.map((history, index) => 
                index === currentChatIndex
                    ? {...history, model: modelName}
                    : history
            );

            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
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
        setChatToLoadOrDelete(index);
        setShowDeleteChatDialog(true);
    };

    const deleteSavedChat = () => {
        setShowDeleteChatDialog(false);
        if (chatToLoadOrDelete !== null) {

            setSavedChatHistories((prevChatHistories) => {
                const updatedChatHistories = [
                    ...prevChatHistories.slice(0, chatToLoadOrDelete),
                    ...prevChatHistories.slice(chatToLoadOrDelete + 1)
                ];

                if (updatedChatHistories.length === 0) {
                    setOpenDrawer(false);
                }

                if (currentChatIndex === chatToLoadOrDelete) {
                    setCurrentChatIndex(0); 
                } else if (chatToLoadOrDelete < currentChatIndex) {
                    setCurrentChatIndex(currentChatIndex - 1);
                } 
                
                setChatToLoadOrDelete(null);
                saveChatHistories(updatedChatHistories);
                return updatedChatHistories;
            })
        }
    };

    const handleCancelDeleteSavedChat = () => {
        setShowDeleteChatDialog(false);
        setChatToLoadOrDelete(null);
    };
    
    const handleLoadSavedChat = (index: number) => {
        setCurrentChatIndex(index);
    };

    const handleNewChat = () => {
        if (savedChatHistories.length === 10) {
            setShowChatHistoryFullDialog(true);
        } else {
            const newChatIndex = savedChatHistories.length;
            setCurrentChatIndex(newChatIndex);
            setOpenDrawer(false);
        }
    }

    const renameChat = (newDescription: string, indexToUpdate: number) => {
        setSavedChatHistories((prevChatHistories) => {
            const updatedChatHistories = prevChatHistories.map((history, index) => {
                if (index !== indexToUpdate) return history;

                return { ...history, description: newDescription }; 
            })

            saveChatHistories(updatedChatHistories);
            return updatedChatHistories;
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
                    chatHistory={savedChatHistories[currentChatIndex]}
                    isLoading={isLoading}
                    chatMessageStreamEnd={chatMessageStreamEnd}
                    replayChat={replayChat}
                    setIsFeedbackVisible={setIsFeedbackVisible}
                    setIsGoodResponse={setIsGoodResponse}
                    handleRemoveToastMessage={handleRemoveToastMessage}
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
                        selectedModel = {savedChatHistories[currentChatIndex]?.model || defaultModel}
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
                savedChatHistories={savedChatHistories}
                currentChatIndex={currentChatIndex}
                toggleDrawer={setOpenDrawer} 
                onClearChat={handleClearChat}
                onNewChat={handleNewChat}
                setLangCookie={setLangCookie} 
                logout={handleLogout}
                enabledTools={savedChatHistories[currentChatIndex]?.enabledTools || defaultEnabledTools}
                handleUpdateEnabledTools={handleUpdateEnabledTools}
                selectedModel = {savedChatHistories[currentChatIndex]?.model || defaultModel}
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

            {showChatHistoryFullDialog && 
                <Dialog 
                    open={showChatHistoryFullDialog}
                    onClose={() => setShowChatHistoryFullDialog(false)}
                >
                    <DialogContent>
                        {t("chat.history.full")}
                    </DialogContent>
                </Dialog>
            }
        </>
    )
}

export default MainScreen;