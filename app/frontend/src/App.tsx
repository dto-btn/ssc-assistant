import {
  Alert,
  Box,
  Snackbar,
  Typography,
} from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Cookies from "js-cookie";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { completionMySSC, sendFeedback } from "./api/api";
import {
  AssistantBubble,
  ChatInput,
  Dial,
  Disclaimer,
  TopMenu,
  UserBubble,
  FeedbackForm,
  AlertBubble
} from "./components";
import { DrawerMenu } from "./components/DrawerMenu";
//https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples/msal-react-samples/typescript-sample
import { loginRequest } from "./authConfig";
import { callMsGraph } from './graph';
import { UserContext } from './context/UserContext';
import { v4 as uuidv4 } from 'uuid';
import { AccountInfo, InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import { 
  useIsAuthenticated, 
  useMsal, 
  AuthenticatedTemplate, 
  UnauthenticatedTemplate 
} from "@azure/msal-react";
import CircularProgress from '@mui/material/CircularProgress';
import React from "react";

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: "white",
    },
  },
});

export const App = () => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorSnackbar, setErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [maxMessagesSent] = useState<number>(10);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [uuid, setUuid] = useState<string>(uuidv4());
  const {instance, inProgress} = useMsal();
  const [userData, setUserData] = useState({
    accessToken: '',
    graphData: null
  });
  const isAuthenticated = useIsAuthenticated();
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [feedbackResponse, setFeedbackResponse] = useState<string>("");
  const [isGoodResponse, setIsGoodResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);

  const isACompletion = (object: any): object is Completion => {
    return 'message' in object;
  } 

  const isAMessage = (object: any): object is Message => {
    return 'role' in object;
  }

  const isAToastMessage = (object: any): object is ToastMessage => {
    return 'toastMessage' in object;
  }
  
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
      const completionResponse = await completionMySSC({
        request: request,
        updateLastMessage: updateLastMessage
      });

      setChatHistory((prevChatHistory) => {
        const updatedChatHistory = [...prevChatHistory]; //making a copy
        const lastItemIndex = updatedChatHistory.length - 1;
        const lastItem = updatedChatHistory[lastItemIndex];

        if (isACompletion(lastItem)) {
          updatedChatHistory[lastItemIndex] = {
            ...lastItem,
              message: {
                ...lastItem.message,
                context: completionResponse.message.context
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

  const makeApiRequest = async (question: string) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);

    const userMessage: Message = {
      role: "user",
      content: question
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
      tools: ['corporate', 'geds'],
      uuid: uuid,
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

  const handleCloseSnackbar = (
    _event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    setErrorSnackbar(false);
  };

  const replayChat = () => {
    const lastQuestion = chatHistory[chatHistory.length - 2];
    setChatHistory(chatHistory => chatHistory.slice(0, chatHistory.length - 2));
    if (isAMessage(lastQuestion)) {
      makeApiRequest(lastQuestion.content ? lastQuestion.content : "");
    }
  };

  const saveChatHistory = (chatHistory: ChatItem[]) => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory.filter(item => !isAToastMessage(item))));
  };

  // This function will be used to load the chat history from localStorage
  const loadChatHistory = () => {
    const savedChatHistory = localStorage.getItem("chatHistory");
    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory));
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem("chatHistory"); // Clear chat history from local storage
    setWelcomeMessage(userData.graphData);
    setUuid(uuidv4());
  };

  const setLangCookie = () => {
    Cookies.set("lang_setting", i18n.language, {
      expires: 30,
    });
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
      content: t("welcome.prompt.user", {givenName: graphData['givenName'], surname: graphData['surname']})
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
    };

    sendApiRequest(request);
  }

  useEffect(() => {
    if (isAuthenticated && !userData.graphData && inProgress === InteractionStatus.None) {
      callMsGraph().then(response => {
        setUserData({accessToken: response.accessToken, graphData: response.graphData});
      }).catch((e) => {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect({
            ...loginRequest,
            account: instance.getActiveAccount() as AccountInfo
          }).catch((e) => {
            setErrorMessage("Unable to login: " + e);
          });
        }else{
          setErrorMessage("Unable to login via any methods");
        }
      });
    } else if(isAuthenticated && userData.graphData && inProgress === InteractionStatus.None){
      //we just logged in and we make sure if chat was empty, we load the welcome message.
      if(chatHistory.length === 0) {
        setWelcomeMessage(userData.graphData);
      }
    }
  }, [inProgress, userData, instance, isAuthenticated]);

  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Scrolls the last updated message (if its streaming, or once done) into view
  useEffect(() => {
    // maybe check here if its a completion before scrolling?
    chatMessageStreamEnd.current?.scrollIntoView({behavior: "smooth",});
  }, [chatHistory[chatHistory.length - 1]]);

  // Load chat history if present
  useEffect(() => {
    loadChatHistory();
  }, []);

  const handleRemoveToastMessage = useCallback((indexToRemove: number) => {
    setChatHistory(prevChatHistory => {
      return prevChatHistory.filter((_item, index) => index !== indexToRemove);
    });
  }, []);

  return (
    <UserContext.Provider value={userData}>
      <UnauthenticatedTemplate>
        <Typography variant="h6" align="center">Connexion en cours...</Typography>
        <br></br>
        <Typography variant="h6" align="center">Signing you in ...</Typography>
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <ThemeProvider theme={mainTheme}>
          <CssBaseline />
          <TopMenu toggleDrawer={setOpenDrawer} />
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
            <Box
              sx={{
                overflowY: "hidden",
                padding: "2rem",
                paddingTop: "6rem",
                alignItems: "flex-end",
              }}
            >
              {chatHistory.length === 0 && (
                <>
                  <svg width={0} height={0}>
                    <defs>
                      <linearGradient id="multicolor" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#e01cd5" />
                        <stop offset="100%" stopColor="#1CB5E0" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: '2rem' }}>
                    <CircularProgress sx={{ 'svg circle': { stroke: 'url(#multicolor)' } }} size={50} />
                  </Box>
                </>
              )}
              {chatHistory.map((chatItem, index) => (
                <Fragment key={index}>

                  {isACompletion(chatItem) && chatItem.message.content && (
                    <AssistantBubble
                      text={chatItem.message.content}
                      isLoading={index == chatHistory.length-1 && isLoading}
                      context={chatItem.message?.context}
                      scrollRef={chatMessageStreamEnd}
                      replayChat={replayChat}
                      index={index}
                      total={chatHistory.length}
                      setIsFeedbackVisible={setIsFeedbackVisible}
                      setIsGoodResponse={setIsGoodResponse}
                      />
                  )}

                  {isAMessage(chatItem) && (
                    <UserBubble text={chatItem.content} />
                  )}

                  {isAToastMessage(chatItem) && (
                    <AlertBubble 
                      toast={chatItem} 
                      index={index} 
                      removeMessageHandler={handleRemoveToastMessage}
                    />
                  )}

                </Fragment>
              ))}
            </Box>
            <div ref={chatMessageStreamEnd} />
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
              />
            </Box>
          </Box>
          <Snackbar
            open={errorSnackbar}
            autoHideDuration={6000}
            onClose={handleCloseSnackbar}
            sx={{ mb: 1 }}
          >
            <Alert
              onClose={handleCloseSnackbar}
              severity="error"
              variant="filled"
              sx={{ width: "100%" }}
            >
              {errorMessage}
            </Alert>
          </Snackbar>
          <Dial drawerVisible={openDrawer} onClearChat={handleClearChat} />
          <Disclaimer />
          <DrawerMenu openDrawer={openDrawer} toggleDrawer={setOpenDrawer} onClearChat={handleClearChat} setLangCookie={setLangCookie} logout={handleLogout}/>
          <FeedbackForm
            feedback={feedback}
            setFeedback={setFeedback}
            open={isFeedbackVisible}
            handleClose={() => setIsFeedbackVisible(false)}
            handleFeedbackSubmit={handleFeedbackSubmit}
          />
        </ThemeProvider>
      </AuthenticatedTemplate>
    </UserContext.Provider>
  );
};
