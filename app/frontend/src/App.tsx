import {
  Box,
  IconButton,
  Tooltip,
  Typography,
} from "@mui/material";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProvider, createTheme, styled } from "@mui/material/styles";
import Cookies from "js-cookie";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { completionMySSC, sendFeedback } from "./api/api";
import { isTokenExpired } from "./util/token";
import {
  AssistantBubble,
  ChatInput,
  Dial,
  Disclaimer,
  TopMenu,
  UserBubble,
  FeedbackForm,
  AlertBubble,
  DrawerMenu
} from "./components";
import logo from "./assets/SSC-Logo-Purple-Leaf-300x300.png"
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import { isACompletion, isAMessage, isAToastMessage } from "./utils";
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
  const [maxMessagesSent] = useState<number>(10);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [openDrawer, setOpenDrawer] = useState<boolean>(false);
  const [uuid, setUuid] = useState<string>(uuidv4());
  const {instance, inProgress} = useMsal();
  const [userData, setUserData] = useState({
    accessToken: '',
    graphData: null
  });
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({
    "geds": true,
    "corporate": true,
  })
  const isAuthenticated = useIsAuthenticated();
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [isGoodResponse, setIsGoodResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [quotedText, setQuotedText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [replyTooltipVisible, setReplyTooltipVisible] = useState(false);
  const [replyTooltipPosition, setReplyTooltipPosition] = useState({ x: 0, y: 0 });

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

  const makeApiRequest = async (question: string) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);
    setQuotedText('');

    const userMessage: Message = {
      role: "user",
      content: question,
      quotedText: quotedText
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
      quotedText: quotedText
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
  const loadChatHistoryAndTools = () => {
    const savedChatHistory = localStorage.getItem("chatHistory");
    const enabledToolHistory = localStorage.getItem("enabledTools");
    if (savedChatHistory) {
      setChatHistory(JSON.parse(savedChatHistory));
    }
    if (enabledToolHistory) {
      setEnabledTools(JSON.parse(enabledToolHistory));
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
    };

    sendApiRequest(request);
  }

  useEffect(() => {
    console.debug(inProgress);
    if (isAuthenticated && !userData.graphData && inProgress === InteractionStatus.None) {
      console.debug("Acquire silent token.");
      instance.acquireTokenSilent({
          ...loginRequest,
          account: instance.getActiveAccount() as AccountInfo
      }).then(response => {
        setUserData({accessToken: response.accessToken, graphData: null});
      }).catch((e) => {
        if (e instanceof InteractionRequiredAuthError) {
          console.warn("Unable to get token via silent method, will use redirect instead.");
          instance.acquireTokenRedirect({
            ...loginRequest,
            account: instance.getActiveAccount() as AccountInfo
          })
        }
      });
    }
  }, [inProgress, userData.graphData, isAuthenticated]);

  // Effect for calling Microsoft Graph after acquiring a token
  useEffect(() => {
    if (userData.accessToken && !userData.graphData) {
      callMsGraph(userData.accessToken).then(response => {
        setUserData({ accessToken: userData.accessToken, graphData: response.graphData });
      });
    }
  }, [userData.accessToken]);

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
    loadChatHistoryAndTools();
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
  }

  const handleTextSelected = (tooltipPosition: { x: number; y: number }, selectedText: string): void => {
    if (selectedText) {
      setSelectedText(selectedText);
      setReplyTooltipVisible(true)
      setReplyTooltipPosition(tooltipPosition)
    } else {
      setReplyTooltipVisible(false)
      setSelectedText('')
    }
  }

  const handleRemoveQuote = () => {
    setSelectedText('');
    setQuotedText('');
  }

  const onQuoteReponseClicked = () => {
    setQuotedText(selectedText);
    setReplyTooltipVisible(false);
    setSelectedText('');
    window.getSelection()?.removeAllRanges();
  }

  return (
    <UserContext.Provider value={userData}>
      <UnauthenticatedTemplate>
        <ConnectingScreen>
          <ConnectingContainer>
            <img src={logo} style={{width: 'auto', height: '100px'}} alt="logo of SSC" />
            <ConnectingTextWrapper>
              <ConnectingText variant="h6" align="left">En cours de connection...</ConnectingText>
              <ConnectingText variant="h6" align="left">Connecting...</ConnectingText>
            </ConnectingTextWrapper>
          </ConnectingContainer>
          <LoadingSpinnerView sx={{ display: 'flex', justifyContent: 'center', my: '2rem', marginTop: '100px' }}>
            <CircularProgress
              sx={{ color: 'url(#multicolor)' }}
              size={50}
            />
          </LoadingSpinnerView>
        </ConnectingScreen>
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
                padding: "3rem",
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
                      toolsInfo={chatItem.message.tools_info}
                      scrollRef={chatMessageStreamEnd}
                      replayChat={replayChat}
                      index={index}
                      total={chatHistory.length}
                      setIsFeedbackVisible={setIsFeedbackVisible}
                      setIsGoodResponse={setIsGoodResponse}
                      handleTextSelected={handleTextSelected}
                      />
                  )}

                  {isAMessage(chatItem) && (
                    <UserBubble text={chatItem.content} quote={chatItem.quotedText}/>
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
              />
            </Box>
          </Box>
          <Dial drawerVisible={openDrawer} onClearChat={handleClearChat} />
          <Disclaimer />
          <DrawerMenu 
            openDrawer={openDrawer} 
            toggleDrawer={setOpenDrawer} 
            onClearChat={handleClearChat} 
            setLangCookie={setLangCookie} 
            logout={handleLogout}
            enabledTools={enabledTools}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
          />
          <FeedbackForm
            feedback={feedback}
            setFeedback={setFeedback}
            open={isFeedbackVisible}
            handleClose={() => setIsFeedbackVisible(false)}
            handleFeedbackSubmit={handleFeedbackSubmit}
          />
          {replyTooltipVisible &&
          <Tooltip  title={<Typography variant="body1">{t("reply")}</Typography>}  placement='top'>
            <IconButton 
              onClick={() => onQuoteReponseClicked()}
              id="replyButton"
              sx={{
                position: 'absolute',
                top: replyTooltipPosition.y - 45,
                left: replyTooltipPosition.x,
                height: '30px',
                width: '50px',
                border: '1px solid',
                fontSize: '32px',
                backgroundColor: 'white',
                zIndex: 1000,
                '&:hover': {
                  backgroundColor: 'white', 
                  boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)', 
                },
               }}>
              <FormatQuoteIcon sx={{color: "black"}}/>
            </IconButton>
          </Tooltip>
          }
        </ThemeProvider>
      </AuthenticatedTemplate>
    </UserContext.Provider>
  );
};

const ConnectingScreen = styled(Box)`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  height: 70vh;
`;

const ConnectingContainer = styled(Box)`
  display: flex;
  justify-content: center;
  width: 25%;
  padding: 50px;
`;

const ConnectingTextWrapper = styled(Box)`
  margin-left: 50px;
`;

const ConnectingText = styled(Typography)`
  padding: 10px 0px;
`;

const LoadingSpinnerView = styled(Box)`
  display: flex;
  justify-content: center;
`;
