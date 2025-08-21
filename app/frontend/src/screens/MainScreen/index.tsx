import { Box, IconButton } from "@mui/material";
import {
  ChatInput,
  Disclaimer,
  DrawerMenu,
  FeedbackForm,
  TopMenuHomePage,
} from "../../components";
import ChatMessagesContainer from "../../containers/ChatMessagesContainer";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState } from "react";
import { useIsAuthenticated, useMsal } from "@azure/msal-react";
import { isAMessage } from "../../utils";
import { InteractionStatus } from "@azure/msal-browser";
import { v4 as uuidv4 } from "uuid";
import { bookReservation } from "../../api/api";
import { callMsGraph } from "../../graph";
import { UserContext } from "../../stores/UserContext";
import { DeleteConversationConfirmation } from "../../components/DeleteConversationConfirmation";
import { useLocation } from "react-router";
import { ParsedSuggestionContext } from "../../routes/SuggestCallbackRoute";
import { useAppStore } from "../../stores/AppStore";
import Typography from "@mui/material/Typography";
import { SNACKBAR_DEBOUNCE_KEYS, LEFT_MENU_WIDTH } from "../../constants";
import VerticalSplitIcon from "@mui/icons-material/VerticalSplit";
import NewLayout from "../../components/layouts/NewLayout";
import { useChatStore } from "../../stores/ChatStore";
import { PersistenceUtils } from "../../util/persistence";
import { useChatService } from "../../hooks/useChatService";
import { useApiRequestService } from "./useApiRequestService";
import { defaultEnabledTools } from "../../allowedTools";
import { tt } from "../../i18n/tt";
import Suggestions from "../../components/Suggestions";

const MainScreen = () => {
  const { t } = useTranslation();
  const appStore = useAppStore();
  const {
    currentChatIndex,
    getCurrentChatHistory,
    chatHistoriesDescriptions,
    setCurrentChatHistory,
    setDefaultChatHistory,
    getDefaultModel,
    setCurrentChatIndex: chatStoreSetCurrentChatIndex,
    setChatHistoriesDescriptions,
    quotedText,
  } = useChatStore();
  const chatService = useChatService();
  const apiRequestService = useApiRequestService();

  // Computes tools to send to API: if conversation has staticTools, they take precedence; otherwise use current enabledTools from app store
  const getEffectiveEnabledTools = (): Record<string, boolean> => {
    const staticTools = getCurrentChatHistory().staticTools || [];
    if (staticTools.length > 0) {
      const record: Record<string, boolean> = {};
      staticTools.forEach((tool) => {
        record[tool] = true;
      });
      return record;
    }
    return appStore.tools.enabledTools;
  };

  const [userData, setUserData] = useState({
    graphData: null,
    profilePictureURL: "",
  });

  const location = useLocation();
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [chatIndexToLoadOrDelete, setChatIndexToLoadOrDelete] = useState<
    number | null
  >(null);
  const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);

  const { instance, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();

  const chatRef = useRef<HTMLDivElement>(null);
  const lastCompletionRef = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(true);
  const [tailing, setTailing] = useState(false);
  const [canTail, setCanTail] = useState(false);

  // Check if the chat container is scrolled to the bottom or not scrollable
  const isAtBottom = () => {
    const container = chatRef.current;
    if (container) {
      // True if the content is taller than the visible area (scrollable)
      const isScrollable = container.scrollHeight > container.clientHeight + 1;
      // True if the user is NOT at the bottom (allowing for 1px rounding error)
      const notAtBottom = container.scrollTop + container.clientHeight < container.scrollHeight - 1;
      return isScrollable && notAtBottom;
    }
    return false;
  }

  // Handle scroll events in chat container
  const handleScroll = () => {
    console.log("Handling scroll event in chat container");
    setScrollable(isAtBottom());
  }

  // Scroll to the bottom of the chat container
  const onScrollArrowClick = () => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
    // if (apiRequestService.isLoading) {
    //   setTailing(true);
    // }
  };

  const sendMessage = (question: string, attachments: Attachment[]) => {
    apiRequestService.makeApiRequest(
      question,
      userData,
      attachments,
      undefined,
      getEffectiveEnabledTools()
    )

    // setTimeout(() => {
    //   setCanTail(true);
    // }, 1000);
  };

  const replayChat = () => {
    const currentChatHistoryItems = getCurrentChatHistory().chatItems;
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

      chatService.saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });

    if (isAMessage(lastQuestion)) {
      apiRequestService.makeApiRequest(
        lastQuestion.content ? lastQuestion.content : "",
        userData,
        undefined,
        lastQuestion.quotedText,
        getEffectiveEnabledTools()
      );
    }
  };

  // Function to stop the chat and append a message indicating the response was stopped
  const stopChat = () => {
    apiRequestService.abortRequest(); // Abort the ongoing request to stop the response


    setCurrentChatHistory((prevChatHistory) => {
      const chatItems = [...prevChatHistory.chatItems];
      if (chatItems.length === 0) return prevChatHistory;

      // Get the last assistant message
      const lastIndex = chatItems.length - 1;
      // Should use a guard, but asserting because last chatItem is always the completion
      const lastItem = chatItems[lastIndex] as Completion;

      // If it's an assistant message (Message type), append the stop text
      if (lastItem && lastItem.message && typeof lastItem.message.content === "string") {
        chatItems[lastIndex] = {
          ...lastItem,
          message: {
            ...lastItem.message,
            content: lastItem.message.content + "\n\n" + t("responseStopped", "You've stopped this response"),
          },
        };
      }

      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems,
      };

      chatService.saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });
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
      setDefaultChatHistory();
    }
  };

  const loadEnabledToolsFromStorage = () => {
    try {
      const enabledTools = PersistenceUtils.getEnabledTools() || {};

      // clean the enabled tools. we should only set the tools that are included in defaultEnabledTools and no other.
      const cleanedTools = { ...defaultEnabledTools };
      for (const key in cleanedTools) {
        if (
          enabledTools.hasOwnProperty(key) &&
          typeof enabledTools[key] === "boolean"
        ) {
          cleanedTools[key] = enabledTools[key];
        }
      }

      appStore.tools.setEnabledTools(cleanedTools);
    } catch (error) {
      // Gracefully handle any errors.
      console.error("Error loading chat histories from local storage", error);
      appStore.tools.setEnabledTools(defaultEnabledTools);
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: "/",
    });
  };

  // Scrolls the last updated message (if its streaming, or once done) into view
  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [getCurrentChatHistory().chatItems]);

  // Load chat histories and persisted tools if present
  useEffect(() => {
    loadChatHistoriesFromStorage();
    loadEnabledToolsFromStorage();
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

  const handleUpdateEnabledTools = (name: string, forceOn?: boolean) => {
    let updatedTools: Record<string, boolean> = {
      ...appStore.tools.enabledTools,
    };
    const toolIsTurningOn: boolean =
      forceOn == true ? true : !appStore.tools.enabledTools[name];

    // Finally, update the specific tool's state
    updatedTools[name] = toolIsTurningOn;

    // Update the app store with the new enabled tools
    appStore.tools.setEnabledTools(updatedTools);

    // Save the updated tools to local storage
    PersistenceUtils.setEnabledTools(updatedTools);
  };

  const hanldeUpdateModelVersion = (modelName: string) => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        model: modelName,
      };
      chatService.saveChatHistories(updatedChatHistory);
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
      chatService.deleteSavedChat(chatIndexToLoadOrDelete);
    }
  };

  const handleCancelDeleteSavedChat = () => {
    setShowDeleteChatDialog(false);
    setChatIndexToLoadOrDelete(null);
  };

  const handleFileUploadError = (toast: ToastMessage) => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [...prevChatHistory.chatItems, toast],
      };
      chatService.saveChatHistories(updatedChatHistory);
      return updatedChatHistory;
    });
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
      chatService.saveChatHistories(updatedChatHistory);
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
        chatService.setCurrentChatIndex(newChatIndex);
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
          isTopicSet: true, // Set to true since we have a topic
          staticTools: [],
        };
        setCurrentChatHistory(newChatHistory);
        setChatHistoriesDescriptions([
          ...chatHistoriesDescriptions,
          parsedSuggestionContext.context.original_query,
        ]);
      } else {
        const showError = (msg: string) => {
          appStore.snackbars.show(
            msg,
            SNACKBAR_DEBOUNCE_KEYS.SUGGEST_CONTEXT_ERROR
          );
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

  const onSuggestionClicked = (
    question: string,
    tool: string,
    isStatic: boolean
  ) => {
    let updatedTools: Record<string, boolean> = {
      ...appStore.tools.enabledTools,
    };
    updatedTools[tool] = true;

    // if we have a tool passed as static we update the current chat to stick to that tool
    if (isStatic)
      setCurrentChatHistory((prevChatHistory) => {
        const updatedChatHistory: ChatHistory = {
          ...prevChatHistory,
          staticTools: [tool],
        };
        chatService.saveChatHistories(updatedChatHistory);
        return updatedChatHistory;
      });

    appStore.tools.setEnabledTools(updatedTools);
    PersistenceUtils.setEnabledTools(updatedTools);
    apiRequestService.makeApiRequest(
      question,
      userData,
      undefined,
      undefined,
      getEffectiveEnabledTools()
    );
  };

  return (
    <UserContext.Provider value={userData}>
      <NewLayout
        appBar={
          <TopMenuHomePage
            childrenLeftOfLogo={
              <>
                <IconButton
                  sx={{
                    color: "white",
                  }}
                  onClick={() => appStore.appDrawer.toggle()}
                  aria-label={tt("drawer.icon.title")}
                  title={tt("drawer.icon.title")}
                >
                  <VerticalSplitIcon />
                </IconButton>
              </>
            }
            enabledTools={appStore.tools.enabledTools}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
            handleSelectedModelChanged={hanldeUpdateModelVersion}
            selectedModel={getCurrentChatHistory().model}
            logout={handleLogout}
          />
        }
        appDrawerContents={
          <DrawerMenu
            chatDescriptions={chatHistoriesDescriptions}
            currentChatIndex={currentChatIndex}
            handleDeleteSavedChat={handleDeleteSavedChat}
            handleLoadSavedChat={chatService.handleLoadSavedChat}
            renameChat={chatService.renameChat}
            onNewChat={chatService.handleNewChat}
          />
        }
      >
        {getCurrentChatHistory().chatItems.length === 0 ? (
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
              <Suggestions
                onSuggestionClicked={onSuggestionClicked}
                tools={Object.keys(appStore.tools.enabledTools).filter(
                  (tool) => appStore.tools.enabledTools[tool]
                )}
              />
              <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={apiRequestService.isLoading}
                onSend={sendMessage}
                onStop={stopChat}
                quotedText={quotedText}
                selectedModel={getCurrentChatHistory().model}
                onError={handleFileUploadError}
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
              left: appStore.appDrawer.isOpen ? LEFT_MENU_WIDTH : 0,
              right: 0,
              bottom: 0,
              paddingTop: "3rem",
            }}
          >
            <Box sx={{ flexGrow: 1 }}></Box>
            <ChatMessagesContainer
              chatHistory={getCurrentChatHistory()}
              isLoading={apiRequestService.isLoading}
              chatMessageStreamEnd={chatMessageStreamEnd}
              replayChat={replayChat}
              handleRemoveToastMessage={handleRemoveToastMessage}
              handleBookReservation={handleBookReservation}
              containerRef={chatRef}
              lastCompletionRef={lastCompletionRef}
              handleScroll={handleScroll}
              onScrollArrowClick={onScrollArrowClick}
              scrollable={scrollable}
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
                disabled={apiRequestService.isLoading}
                onSend={sendMessage}
                onStop={stopChat}
                quotedText={quotedText}
                selectedModel={getCurrentChatHistory().model}
                onError={handleFileUploadError}
              />
            </Box>
          </Box>
        )}
        <Disclaimer />
        <FeedbackForm />
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
