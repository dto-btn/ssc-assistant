import {
  Alert,
  Box,
  Snackbar,
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
} from "./components";
import { DrawerMenu } from "./components/DrawerMenu";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { loginRequest } from "./authConfig";
import { callMsGraph } from './graph';
import { UserContext } from './context/UserContext';
import { v4 as uuidv4 } from 'uuid';

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

export const enum ChatWith {
  Data = "data",
  Tools = "tools",
}

export const App = () => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorSnackbar, setErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [maxMessagesSent] = useState<number>(10);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null); 
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const isAuthenticated = useIsAuthenticated();
  const {instance, accounts} = useMsal();
  const [uuid, setUuid] = useState<string>('');  
  const [userData, setUserData] = useState({
    accessToken: '',
    graphData: null
  });

  const welcomeMessage: Completion = {
    message: {
      role: "assistant",
      content: t("default.welcome.msg"),
    } as Message,
  };

  const [completions, setCompletions] = useState<Completion[]>([
    welcomeMessage,
  ]);

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
    setLastUserMessage(question);

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

  const handleFeedbackSubmit = async (feedback: string, isGoodResponse: boolean) => {      
    sendFeedback(feedback, isGoodResponse, uuid);  
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
    if (lastUserMessage) {  
      setCompletions(completions => completions.slice(0, completions.length - 2)); // ensures that on chat replay the previous answer is removed and the user's input isn't printed a second time
        makeApiRequest(lastUserMessage); 
    }  
  }; 

  useEffect(() => {
    // Set the `lang` attribute whenever the language changes
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(
    () =>
      chatMessageStreamEnd.current?.scrollIntoView({
        behavior: "smooth",
      }),
    [completions[completions.length - 1].message.content]
  );

  useEffect(() => {
    setUuid(uuidv4());
  }, []);

  const saveChatHistory = (chatHistory: Completion[]) => {
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory));
  };

  // This function will be used to load the chat history from localStorage
  const loadChatHistory = () => {
    const savedChatHistory = localStorage.getItem("chatHistory");
    if (savedChatHistory) {
      setCompletions(JSON.parse(savedChatHistory));
    } else {
      setCompletions([welcomeMessage]);
    }
  };

  const handleClearChat = () => {
    localStorage.removeItem("chatHistory"); // Clear chat history from local storage
    setCompletions([welcomeMessage]);
    setUuid(uuidv4());
  };

  const setLangCookie = () => {
    Cookies.set("lang_setting", i18n.language, {
      expires: 30,
    });
  };

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((e) => {
      setErrorSnackbar(true);
      if (e instanceof Error) {
        setErrorMessage(e.message);
      } else {
        setErrorMessage("Unable to login.");
      }
    });
  };

  const handleLogout = () => {
    setUserData({accessToken: '', graphData: null});
    instance.logoutRedirect({
      postLogoutRedirectUri: "/",
    });
  };

  // Load chat history if present
  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      // If the user is authenticated, you might want to acquire a token silently
      // or handle the logged-in user's information here.
      instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      }).then((response) => {
        const accessToken = response.accessToken;
        callMsGraph(response.accessToken).then((response) => setUserData({accessToken, graphData: response}));
      }).catch(error => {
        setErrorSnackbar(true);
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage("Unable to login.");
        }
      });
    }
  }, [isAuthenticated]);

  return (
    <UserContext.Provider value={userData}>
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
                    handleFeedbackSubmit={handleFeedbackSubmit}
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
        <DrawerMenu openDrawer={openDrawer} toggleDrawer={setOpenDrawer} onClearChat={handleClearChat} setLangCookie={setLangCookie} login={handleLogin} logout={handleLogout}/>
      </ThemeProvider>
    </UserContext.Provider>
  );
};
