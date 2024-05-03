import {
  Alert,
  Box,
  Snackbar,
  Typography,
} from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import Cookies from "js-cookie";
import { Fragment, useEffect, useRef, useState } from "react";
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
  const [isGoodResponse, setIsGoodResponse] = useState(false);
  const [isThankYouVisible, setIsThankYouVisible] = useState(false);
  const [completions, setCompletions] = useState<Completion[]>([]);

  const convertCompletionsToMessages = (
    completions: Completion[]
  ): Message[] => {
    // Calculate the start index to slice from if the array length exceeds maxMessagesSent
    const startIndex = Math.max(completions.length - maxMessagesSent, 0);
    return completions.slice(startIndex).map(
      (c) =>
        ({
          role: c.message.role,
          content: c.message.content,
        } as Message)
    );
  };

  const makeApiRequest = async (question: string) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);

    const userCompletion: Completion = {
      message: {
        role: "user",
        content: question,
      },
    };

    const responsePlaceholder: Completion = {
      message: {
        role: "assistant",
        content: "",
      },
    };

    const messages = convertCompletionsToMessages([
      ...completions,
      userCompletion,
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
    setCompletions((prevCompletions) => {
      const updatedCompletions = [
        ...prevCompletions,
        userCompletion,
        responsePlaceholder,
      ];
      saveChatHistory(updatedCompletions); // Save chat history to local storage
      return updatedCompletions;
    });

    try {
      const completionResponse = await completionMySSC({
        request: request,
        updateLastMessage: updateLastMessage
      });

      setCompletions((prevCompletions) => {
        const updatedCompletions = [...prevCompletions]; //making a copy

        updatedCompletions[updatedCompletions.length - 1] = {
          ...updatedCompletions[updatedCompletions.length - 1],
          message: {
            ...updatedCompletions[updatedCompletions.length - 1].message,
            context: completionResponse.message.context,
          },
        };
        saveChatHistory(updatedCompletions); // Save chat history to local storage
        return updatedCompletions;
      });
    } catch (error) {
      setErrorSnackbar(true);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unknown error occurred");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedbackSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    sendFeedback(feedback, isGoodResponse, uuid);
    setFeedback('');
    setIsThankYouVisible(true);
  };

  const updateLastMessage = (message_chunk: string) => {
    setCompletions((prevCompletions) => {
      const updatedCompletions = [...prevCompletions]; //making a copy

      updatedCompletions[updatedCompletions.length - 1] = {
        ...updatedCompletions[updatedCompletions.length - 1],
        message: {
          ...updatedCompletions[updatedCompletions.length - 1].message,
          content: message_chunk,
        },
      };
      return updatedCompletions;
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
    const lastQuestion = completions[completions.length - 2];
    setCompletions(completions => completions.slice(0, completions.length - 2));
    makeApiRequest(lastQuestion.message.content ? lastQuestion.message.content : "");
  };

  const saveChatHistory = (chatHistory: Completion[]) => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  };

  // This function will be used to load the chat history from localStorage
  const loadChatHistory = () => {
    const savedChatHistory = localStorage.getItem("chatHistory");
    if (savedChatHistory) {
      setCompletions(JSON.parse(savedChatHistory));
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

    const systemMessage: Completion = {
      message: {
        role: "system",
        content: t("welcome.prompt.system"),
      },
    };

    const welcomeMessageRequest: Completion = {
      message: {
        role: "user",
        content: t("welcome.prompt.user", {givenName: graphData['givenName'], surname: graphData['surname']})
      },
    };

    const messages = convertCompletionsToMessages([
      systemMessage,
      welcomeMessageRequest
    ]);

    const responsePlaceholder: Completion = {
      message: {
        role: "assistant",
        content: "",
      },
    };

    //update current chat window with the message sent..
    setCompletions([responsePlaceholder]);

    // prepare request bundle
    const request: MessageRequest = {
      messages: messages,
      max: maxMessagesSent,
      top: 5,
      tools: [],
      uuid: uuid,
    };

    try {
      const completionResponse = await completionMySSC({
        request: request,
        updateLastMessage: updateLastMessage
      });

      setCompletions((prevCompletions) => {
        const updatedCompletions = [...prevCompletions]; //making a copy

        updatedCompletions[updatedCompletions.length - 1] = {
          ...updatedCompletions[updatedCompletions.length - 1],
          message: {
            ...updatedCompletions[updatedCompletions.length - 1].message,
            context: completionResponse.message.context,
          },
        };
        saveChatHistory(updatedCompletions); // Save chat history to local storage
        return updatedCompletions;
      });
    } catch (error) {
      setErrorSnackbar(true);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("An unknown error occurred");
      }
    } finally {
      setIsLoading(false);
    }
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
      if(completions.length === 0)
        setWelcomeMessage(userData.graphData);
    }
  }, [inProgress, userData, instance, isAuthenticated]);

  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  //scroll's the last updated message (if its streaming, or once done) into view
  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({behavior: "smooth",});
  }, [completions[completions.length - 1]?.message.content]);

  // Load chat history if present
  useEffect(() => {
    loadChatHistory();
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
              {completions.length === 0 && (
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
              {completions.map((completion, index) => (
                <Fragment key={index}>
                  {completion.message?.role === "assistant" && completion.message?.content && (
                    <AssistantBubble
                      text={completion.message.content}
                      isLoading={index == completions.length-1 && isLoading}
                      context={completion.message?.context}
                      scrollRef={chatMessageStreamEnd}
                      replayChat={replayChat}
                      index={index}
                      total={completions.length}
                      setIsFeedbackVisible={setIsFeedbackVisible}
                      setIsGoodResponse={setIsGoodResponse}
                      />
                  )}

                  {completion.message?.role === "user" && (
                    <UserBubble text={completion.message?.content} />
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
            isThankYouVisible={isThankYouVisible}
            setIsThankYouVisible={setIsThankYouVisible}
          />
        </ThemeProvider>
      </AuthenticatedTemplate>
    </UserContext.Provider>
  );
};
