import {
  Box,
  IconButton,
} from "@mui/material";
import {
  ChatInput,
  Disclaimer,
  DrawerMenu,
  FeedbackForm,
  TopMenuHomePage,
} from "../../components";
import ChatMessagesContainer from "../../containers/ChatMessagesContainer";
import { useTranslation } from "react-i18next"
import React, { useEffect, useRef, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { isACompletion, isAMessage, isAToastMessage } from "../../utils";
import { isTokenExpired } from "../../util/token";
import { completionMySSC, sendFeedback } from "../../api/api";
import { apiUse } from "../../authConfig";
import { AccountInfo, InteractionStatus } from "@azure/msal-browser";
import { v4 as uuidv4 } from "uuid";
import { bookReservation } from "../../api/api";
import { allowedToolsSet } from "../../allowedTools";
import { callMsGraph } from "../../graph";
import { UserContext } from "../../context/UserContext";
import { DeleteConversationConfirmation } from "../../components/DeleteConversationConfirmation";
import { useLocation } from "react-router";
import { ParsedSuggestionContext } from "../../routes/SuggestCallbackRoute";
import { useAppStore } from "../../context/AppStore";
import Typography from "@mui/material/Typography";
import { LEFT_MENU_WIDTH } from "../../constants/frameDimensions";
import MenuIcon from "@mui/icons-material/Menu";
import NewLayout from "../../components/layouts/NewLayout";
import { useChatStore } from "../../context/ChatStore";
import { PersistenceUtils } from "../../util/persistence";

const MainScreen = () => {
  const { t } = useTranslation();
  const { currentChatIndex, currentChatHistory, setCurrentChatHistory, setDefaultChatHistory, getDefaultModel, setCurrentChatIndex: chatStoreSetCurrentChatIndex } = useChatStore();
  const snackbars = useAppStore((state) => state.snackbars);
  const appDrawer = useAppStore((state) => state.appDrawer);
  const defaultEnabledTools: { [key: string]: boolean } = {};
  allowedToolsSet.forEach((tool) => {
    if (tool == "archibus") defaultEnabledTools[tool] = false;
    else defaultEnabledTools[tool] = true;
  });

  const [userData, setUserData] = useState({
    graphData: null,
    profilePictureURL: "",
  });

  const location = useLocation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [maxMessagesSent] = useState<number>(10);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  // On app launch, keep the drawer open if the screen is larger than lg, else keep it closed.
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isGoodResponse, setIsGoodResponse] = useState(false);
  const [chatHistoriesDescriptions, setChatHistoriesDescriptions] = useState<
    string[]
  >(["Conversation 1"]);
  const [chatIndexToLoadOrDelete, setChatIndexToLoadOrDelete] = useState<
    number | null
  >(null);
  const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);
  const [quotedText, setQuotedText] = useState<string>();
  const [apiAccessToken, setApiAccessToken] = useState<string>("");
  const [enabledTools, setEnabledTools] =
    useState<Record<string, boolean>>(defaultEnabledTools);
  const [selectedCorporateFunction, setSelectedCorporateFunction] =
    useState<string>("intranet_question");

  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();


  const setCurrentChatIndex = (index: number) => {
    // Set the index in local storage
    PersistenceUtils.setCurrentChatIndex(index);
    // Update the state
    chatStoreSetCurrentChatIndex(index);
  };

  const convertChatHistoryToMessages = (chatHistory: ChatItem[]): Message[] => {
    const startIndex = Math.max(chatHistory.length - maxMessagesSent, 0);
    return chatHistory
      .slice(startIndex)
      .map((chatItem) => {
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
      })
      .filter((message) => message !== undefined) as Message[];
  };

  const sendApiRequest = async (request: MessageRequest) => {
    try {
      let token = apiAccessToken;
      if (!apiAccessToken || isTokenExpired(apiAccessToken)) {
        const response = await instance.acquireTokenSilent({
          ...apiUse,
          account: instance.getActiveAccount() as AccountInfo,
          forceRefresh: true,
        });
        setApiAccessToken(response.accessToken);
        token = response.accessToken;
      }

      if (!token) throw new Error(t("no.token"));

      const completionResponse = await completionMySSC({
        request: request,
        updateLastMessage: updateLastMessage,
        accessToken: token,
      });

      setCurrentChatHistory((prevChatHistory) => {
        const updatedChatItems = prevChatHistory?.chatItems.map(
          (item, itemIndex) => {
            if (
              itemIndex === prevChatHistory.chatItems.length - 1 &&
              isACompletion(item)
            ) {
              return {
                ...item,
                message: {
                  ...item.message,
                  context: completionResponse.message.context,
                  tools_info: completionResponse.message.tools_info,
                },
              };
            }
            return item;
          }
        );

        const updatedChatHistory: ChatHistory = {
          ...prevChatHistory,
          chatItems: updatedChatItems,
        };

        // filters toast messages so they're not saved to local storage
        const filteredChatHistory = {
          ...updatedChatHistory,
          chatItems: updatedChatItems.filter((item) => !isAToastMessage(item)),
        };

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

      const toast: ToastMessage = {
        toastMessage: errorMessage,
        isError: true,
      };

      setCurrentChatHistory((prevChatHistory) => {
        const updatedChatHistory = {
          ...prevChatHistory,
          chatItems: [...prevChatHistory.chatItems, toast],
        };
        return updatedChatHistory;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const makeApiRequest = async (
    question: string,
    userData: { graphData: any },
    attachments?: Attachment[],
    quotedTextFromRegenerate?: string
  ) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);
    const messagedQuoted = quotedTextFromRegenerate
      ? quotedTextFromRegenerate
      : quotedText;

    const userMessage: Message = {
      role: "user",
      content: question,
      quotedText: messagedQuoted,
      attachments: attachments,
    };

    const responsePlaceholder: Completion = {
      message: {
        role: "assistant",
        content: "",
      },
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
      tools: Object.keys(enabledTools).filter((key) => enabledTools[key]),
      uuid: currentChatHistory.uuid,
      quotedText: messagedQuoted,
      model: currentChatHistory.model,
      fullName:
        userData.graphData["givenName"] + " " + userData.graphData["surname"],
      corporateFunction: selectedCorporateFunction,
    };

    // update current chat window with the message sent..
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [
          ...prevChatHistory.chatItems,
          userMessage,
          responsePlaceholder,
        ],
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
        isError: false,
      };
    } catch (error) {
      toast = {
        toastMessage: t("feedback.fail"),
        isError: true,
      };
    }

    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [...prevChatHistory.chatItems, toast],
      };

      return updatedChatHistory;
    });

    setFeedback("");
  };

  const updateLastMessage = (message_chunk: string) => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatItems = prevChatHistory?.chatItems.map(
        (item, itemIndex) => {
          if (
            itemIndex === prevChatHistory.chatItems.length - 1 &&
            isACompletion(item)
          ) {
            return {
              ...item,
              message: {
                ...item.message,
                content: message_chunk,
              },
            };
          }
          return item;
        }
      );

      const updatedChatHistory: ChatHistory = {
        ...prevChatHistory,
        chatItems: updatedChatItems,
      };

      saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });
  };

  const replayChat = () => {
    const currentChatHistoryItems = currentChatHistory.chatItems;
    const lastQuestion =
      currentChatHistoryItems[currentChatHistoryItems.length - 2];

    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: prevChatHistory.chatItems.slice(
          0,
          prevChatHistory.chatItems.length - 2
        ),
      };

      saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });

    if (isAMessage(lastQuestion)) {
      makeApiRequest(
        lastQuestion.content ? lastQuestion.content : "",
        userData,
        undefined,
        lastQuestion.quotedText
      );
    }
  };

  const loadChatHistoriesFromStorage = () => {
    const parsedChatHistories = PersistenceUtils.getChatHistories();
    if (parsedChatHistories.length > 0) {
      let currentIndex = PersistenceUtils.getCurrentChatIndex();
      const loadedChatHistory = parsedChatHistories[currentIndex];
      if (!loadedChatHistory) {
        // if the chat history is empty, just set the current chat history to the default
        PersistenceUtils.setCurrentChatIndex(0);
        currentIndex = 0;
      }
      chatStoreSetCurrentChatIndex(currentIndex); //just need to set the state here, no need to modify local storage.
      setCurrentChatHistory(loadedChatHistory);
      setChatHistoriesDescriptions(
        parsedChatHistories.map(
          (chatHistory, index) =>
            chatHistory.description || "Conversation " + (index + 1)
        )
      );
    } else {
      // If there are no chat histories, set the current chat to the default
      setDefaultChatHistory()
    }
  };

  const handleClearChat = () => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [],
      };
      saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: "/",
    });
  };

  // Scrolls the last updated message (if its streaming, or once done) into view
  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChatHistory?.chatItems]);

  // Load chat histories if present
  useEffect(() => {
    loadChatHistoriesFromStorage();
    // TODO: load settings
    const enabledTools = PersistenceUtils.getEnabledTools();
    if (Object.keys(defaultEnabledTools).length == Object.keys(enabledTools).length) {
      setEnabledTools(enabledTools);
    } else {
      setEnabledTools(defaultEnabledTools);
    }
    const selectedCorporateFunction = PersistenceUtils.getSelectedCorporateFunction();
    if (selectedCorporateFunction)
      setSelectedCorporateFunction(selectedCorporateFunction);
  }, []);

  const handleRemoveToastMessage = (indexToRemove: number) => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: prevChatHistory.chatItems.filter(
          (_, itemIndex) => itemIndex !== indexToRemove
        ),
      };

      return updatedChatHistory;
    });
  };

  const saveChatHistories = (updatedChatHistory: ChatHistory) => {
    try {
      const chatHistories = PersistenceUtils.getChatHistories();
      chatHistories[currentChatIndex] = updatedChatHistory;
      PersistenceUtils.setChatHistories(chatHistories);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "QuotaExceededError"
      ) {
        console.error("LocalStorage is full:", error);
        snackbars.show(
          t("storage.full"),
          "STORAGE_FULL_ERROR"
        );
      }
      console.error("Failed to save to localStorage:", error);
    }
  };

  const handleUpdateEnabledTools = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    let updatedTools;

    if (name === "archibus" && checked) {
      // If 'archibus' is enabled, set all other tools to off
      updatedTools = Object.keys(enabledTools).reduce(
        (acc: { [key: string]: boolean }, tool: string) => {
          acc[tool] = tool === "archibus";
          return acc;
        },
        {}
      );
      // disable the function being used
      // (should have no incidence on backend but this is to make it clear to the user)
      setSelectedCorporateFunction("none");
      PersistenceUtils.clearSelectedCorporateFunction();
    } else if (name !== "archibus" && checked) {
      // If any tool other than 'archibus' is enabled, set 'archibus' to off
      updatedTools = {
        ...enabledTools,
        [name]: checked,
        archibus: false,
      };
    } else {
      // Otherwise, just update the specific tool's state
      updatedTools = {
        ...enabledTools,
        [name]: checked,
      };
    }
    setEnabledTools(updatedTools);
    PersistenceUtils.setEnabledTools(updatedTools);
  };

  const handleSetSelectedCorporateFunction = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    //https://mui.com/material-ui/react-radio-button/
    let functionName = (event.target as HTMLInputElement).value;
    setSelectedCorporateFunction(functionName);
    PersistenceUtils.setSelectedCorporateFunction(functionName);
    // disable Archibus if it's checked and on...
    setEnabledTools((enabledTools) => {
      if (functionName == "none") {
        enabledTools["corporate"] = false;
      } else {
        enabledTools["corporate"] = true;
      }
      if (enabledTools.hasOwnProperty("archibus")) {
        enabledTools["archibus"] = false;
      }
      PersistenceUtils.setEnabledTools(enabledTools);
      return enabledTools;
    });
  };

  const hanldeUpdateModelVersion = (modelName: string) => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        model: modelName,
      };
      saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });
  };

  const handleDeleteSavedChat = (index: number) => {
    setChatIndexToLoadOrDelete(index);
    setShowDeleteChatDialog(true);
  };

  const deleteSavedChat = () => {
    setShowDeleteChatDialog(false);
    if (chatIndexToLoadOrDelete !== null) {
      const chatHistories = PersistenceUtils.getChatHistories();
      const updatedChatHistories = [
        ...chatHistories.slice(0, chatIndexToLoadOrDelete),
        ...chatHistories.slice(chatIndexToLoadOrDelete + 1),
      ];

      if (updatedChatHistories.length === 0) {
        // current chat was only chat and at index 0, so just reset state
        setDefaultChatHistory()
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
        setChatHistoriesDescriptions(
          updatedChatHistories.map(
            (chatHistory, index) =>
              chatHistory.description || "Conversation " + (index + 1)
          )
        );
      }

      setChatIndexToLoadOrDelete(null);
      PersistenceUtils.setChatHistories(updatedChatHistories);
    }
  };

  const handleCancelDeleteSavedChat = () => {
    setShowDeleteChatDialog(false);
    setChatIndexToLoadOrDelete(null);
  };

  const handleLoadSavedChat = (index: number) => {
    const chatHistories = PersistenceUtils.getChatHistories();
    if (chatHistories) {
      const newChat = chatHistories[index];
      setCurrentChatHistory(newChat);
      setCurrentChatIndex(index);
    }
  };

  const handleNewChat = () => {
    const chatHistories = PersistenceUtils.getChatHistories();
    const newChatIndex = chatHistoriesDescriptions.length;
    if (chatHistories.length === 10 || newChatIndex >= 10) {
      snackbars.show(
        t("chat.history.full"),
        "CHAT_HISTORY_FULL_ERROR"
      );
    } else {
      setCurrentChatIndex(newChatIndex);
      setDefaultChatHistory()
      setChatHistoriesDescriptions([
        ...chatHistoriesDescriptions,
        "Conversation " + (chatHistoriesDescriptions.length + 1),
      ]);
    }
  };

  const renameChat = (newDescription: string, indexToUpdate: number) => {
    const chatHistories = PersistenceUtils.getChatHistories();
    const updatedChatHistories = [...chatHistories];
    const updatedChatHistory: ChatHistory = {
      ...chatHistories[indexToUpdate],
      description: newDescription,
    };
    updatedChatHistories[indexToUpdate] = updatedChatHistory;
    PersistenceUtils.setChatHistories(updatedChatHistories);
    if (currentChatIndex === indexToUpdate) {
      setCurrentChatHistory(updatedChatHistory);
    }
    setChatHistoriesDescriptions(
      updatedChatHistories.map(
        (chatHistory, index) =>
          chatHistory.description || "Conversation " + (index + 1)
      )
    );
  };

  const handleBookReservation = async (bookingDetails: BookingConfirmation) => {
    let toast: ToastMessage;
    try {
      await bookReservation(bookingDetails);
      toast = {
        toastMessage: `${t("booking.success")} ${bookingDetails.startDate}`,
        isError: false,
      };
    } catch (error) {
      toast = {
        toastMessage: `${t("booking.fail")} ${error}`,
        isError: true,
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
  };

  useEffect(() => {
    console.debug(
      "useEffect[inProgress, userData.graphData] -> If graphData is empty, we will make a call to callMsGraph() to get User.Read data. \n(isAuth? " +
      isAuthenticated +
      ", InProgress? " +
      inProgress +
      ")"
    );
    if (
      isAuthenticated &&
      !userData.graphData &&
      inProgress === InteractionStatus.None
    ) {
      //we do not have graphData, but since user is logged in we can now fetch it.
      callMsGraph().then((response) => {
        console.debug("callMsGraph() -> Done!");
        setUserData({
          graphData: response.graphData,
          profilePictureURL: response.profilePictureURL,
        });
      });
    }
  }, [isAuthenticated, inProgress, userData]);

  const parsedSuggestionContext: ParsedSuggestionContext | null =
    location.state;
  useEffect(() => {
    // on initial load of page, if state is not null, log the state
    if (parsedSuggestionContext) {
      if (parsedSuggestionContext.success) {
        if (!parsedSuggestionContext.context.success) {
          // this should never happen
          alert(
            "An unknown error occurred while parsing the suggestion context. Your suggestions have not been loaded."
          );
          console.error(
            "ERROR: parsedSuggestionContext:",
            parsedSuggestionContext
          );
          return;
        }
        // TODO: create a new conversation with the context.
        let conversationString = "";
        conversationString += parsedSuggestionContext.context.content;
        conversationString += "\n\n";
        conversationString += parsedSuggestionContext.context.citations
          .flatMap((citation) => {
            return `
#### ${citation.title} [link](${citation.url})

`;
          })
          .join("\n\n");

        // now create a new conversation with the context
        const newChatIndex = chatHistoriesDescriptions.length;
        setCurrentChatIndex(newChatIndex);
        const newChatHistory: ChatHistory = {
          chatItems: [
            {
              role: "user",
              content: parsedSuggestionContext.context.original_query,
            },
            {
              message: {
                role: "assistant",
                content: conversationString,
              },
            },
          ],
          description: parsedSuggestionContext.context.original_query,
          uuid: uuidv4(),
          model: getDefaultModel(),
        };
        setCurrentChatHistory(newChatHistory);
        setChatHistoriesDescriptions([
          ...chatHistoriesDescriptions,
          parsedSuggestionContext.context.original_query,
        ]);
      } else {
        const showError = (msg: string) => {
          /**
           * The suggest context error gets triggered multiple times upon rendering the page.
           * This debounce key is used to prevent multiple snackbars from showing in quick succession.
           */
          const suggestContextErrorDebounceKey = "SUGGEST_CONTEXT_ERROR";
          snackbars.show(msg, suggestContextErrorDebounceKey);
          console.error("ERROR: parsedSuggestionContext", msg);
        };
        switch (parsedSuggestionContext.errorReason) {
          case "redirect_because_context_validation_failed":
            showError(
              "The suggestion context was in an unknown format. Your suggestions have not been loaded."
            );
            break;
          case "redirect_because_server_returned_success_false":
            showError(
              "The server returned an error while parsing the suggestion context. Your suggestions have not been loaded."
            );
            break;
          case "redirect_with_unknown_error":
          default:
            showError(
              "An unknown error occurred while parsing the suggestion context. Your suggestions have not been loaded."
            );
        }
      }
    }
  }, [parsedSuggestionContext]);

  return (
    <UserContext.Provider value={userData}>
      <NewLayout
        appBar={(
          <TopMenuHomePage
            childrenLeftOfLogo={
              <>
                < IconButton sx={{
                  color: 'white',
                }} onClick={() => appDrawer.toggle()}>
                  <MenuIcon />
                </IconButton>
              </>
            }
            handleSetSelectedCorporateFunction={handleSetSelectedCorporateFunction}
            selectedCorporateFunction={selectedCorporateFunction}
            enabledTools={enabledTools}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
            handleSelectedModelChanged={hanldeUpdateModelVersion}
            selectedModel={currentChatHistory.model}
            logout={handleLogout}
          />
        )}
        appDrawerContents={(
          <DrawerMenu
            chatDescriptions={chatHistoriesDescriptions}
            currentChatIndex={currentChatIndex}
            onClearChat={handleClearChat}
            handleDeleteSavedChat={handleDeleteSavedChat}
            handleLoadSavedChat={handleLoadSavedChat}
            renameChat={renameChat}
            onNewChat={handleNewChat}
          />
        )}
      >

        {currentChatHistory.chatItems.length === 0 ? (
          // if 0 chat history
          <Box
            sx={{
              display: "flex",
              flexFlow: "column",
              margin: "auto",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "80vh",
              paddingTop: "3rem",
            }}
            maxWidth="lg"
          >
            <Box
              sx={{
                minWidth: "700px",
                zIndex: 1100,
                bgcolor: "background.default",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "2rem",
              }}
            >
              <Typography
                variant="h1"
                component="h1"
                gutterBottom
                sx={{ fontSize: "3.5rem" }}
              >
                {t("how.can.i.help")}
              </Typography>
              <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={isLoading}
                onSend={(question, attachments) =>
                  makeApiRequest(question, userData, attachments)
                }
                quotedText={quotedText}
                selectedModel={currentChatHistory.model}
              />
            </Box>
          </Box>
        ) : (
          // If 1 chat history
          <Box
            sx={{
              display: "flex",
              flexFlow: "column",
              minHeight: "100vh",
              margin: "auto",
              position: "fixed",
              top: 0,
                left: appDrawer.isOpen ? LEFT_MENU_WIDTH : 0,
              right: 0,
              bottom: 0,
              paddingTop: "3rem",
              overflow: 'auto'
            }}
          // maxWidth="lg"
          >
            <Box sx={{ flexGrow: 1 }}></Box>
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
            <div ref={chatMessageStreamEnd} style={{ height: "50px" }} />
            <Box
              sx={{
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                zIndex: 1100,
                bgcolor: "background.default",
              }}
            >
              <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={isLoading}
                onSend={(question, attachments) =>
                  makeApiRequest(question, userData, attachments)
                }
                quotedText={quotedText}
                selectedModel={currentChatHistory.model}
              />
            </Box>
          </Box>
        )}
        <Disclaimer />

        <FeedbackForm
          feedback={feedback}
          setFeedback={setFeedback}
          open={isFeedbackVisible}
          handleClose={() => setIsFeedbackVisible(false)}
          handleFeedbackSubmit={handleFeedbackSubmit}
        />

        <DeleteConversationConfirmation
          open={showDeleteChatDialog}
          onClose={handleCancelDeleteSavedChat}
          onDelete={deleteSavedChat}
        />
      </NewLayout>
    </UserContext.Provider>
  );
};

export default MainScreen;
