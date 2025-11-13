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
import { useCallback, useEffect, useRef, useState, memo, useContext } from "react";
import { useMsal } from "@azure/msal-react";
import { isAMessage } from "../../utils";
import { v4 as uuidv4 } from "uuid";
import { bookReservation } from "../../api/api";
import { UserContext } from "../../stores/UserContext";
import { DeleteConversationConfirmation } from "../../components/DeleteConversationConfirmation";
import { useLocation } from "react-router";
import { ParsedSuggestionContext, SuggestionContext } from "../../routes/SuggestCallbackRoute";
import { useAppStore } from "../../stores/AppStore";
import Typography from "@mui/material/Typography";
import { SNACKBAR_DEBOUNCE_KEYS, LEFT_MENU_WIDTH } from "../../constants";
import VerticalSplitIcon from "@mui/icons-material/VerticalSplit";
import NewLayout from "../../components/layouts/NewLayout";
import { useChatStore } from "../../stores/ChatStore";
import { PersistenceUtils } from "../../util/persistence";
import { useChatService } from "../../hooks/useChatService";
import { useApiRequestService } from "./useApiRequestService";
import { tt } from "../../i18n/tt";
import Suggestions from "../../components/Suggestions";

const MainScreen = () => {
  const { t } = useTranslation();
  // Select only what this component needs from stores to minimize re-renders
  const appDrawerIsOpen = useAppStore((s) => s.appDrawer.isOpen);
  const toggleAppDrawer = useAppStore((s) => s.appDrawer.toggle);
  const showSnackbar = useAppStore((s) => s.snackbars.show);
  const enabledTools = useAppStore((s) => s.tools.enabledTools);
  const setEnabledTools = useAppStore((s) => s.tools.setEnabledTools);

  const currentChatIndex = useChatStore((s) => s.currentChatIndex);
  const chatHistoriesDescriptions = useChatStore((s) => s.chatHistoriesDescriptions);
  const getCurrentChatHistory = useChatStore((s) => s.getCurrentChatHistory);
  const setCurrentChatHistory = useChatStore((s) => s.setCurrentChatHistory);
  const setDefaultChatHistory = useChatStore((s) => s.setDefaultChatHistory);
  const getDefaultModel = useChatStore((s) => s.getDefaultModel);
  const setChatHistoriesDescriptions = useChatStore((s) => s.setChatHistoriesDescriptions);
  const quotedText = useChatStore((s) => s.quotedText);
  // Chat store now hydrates at creation
  // Avoid calling getCurrentChatHistory() repeatedly in JSX/effects; keep a stable reference per render
  const currentChatHistory = getCurrentChatHistory();
  const chatService = useChatService();
  const apiRequestService = useApiRequestService();

  // Computes tools to send to API: if conversation has staticTools, they take precedence; otherwise use current enabledTools from app store
  const getEffectiveEnabledTools = (override?: Record<string, boolean>): Record<string, boolean> => {
    const staticTools = currentChatHistory.staticTools || [];
    if (staticTools.length > 0) {
      const record: Record<string, boolean> = {};
      staticTools.forEach((tool) => {
        record[tool] = true;
      });
      return record;
    }
    return override ?? enabledTools;
  };

  const userData = useContext(UserContext);

  const location = useLocation();
  const [chatIndexToLoadOrDelete, setChatIndexToLoadOrDelete] = useState<
    number | null
  >(null);
  const [showDeleteChatDialog, setShowDeleteChatDialog] = useState(false);

  const { instance } = useMsal();

  const chatRef = useRef<HTMLDivElement>(null);
  const lastCompletionRef = useRef<HTMLDivElement>(null);
  const chatMessageStreamEnd = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  // Handle scroll events in chat container
  const handleScroll = () => {
    const container = chatRef.current;

    // Check if the chat container is scrolled to the bottom or not scrollable
    if (container) {
      // True if the content is taller than the visible area (scrollable)
      const isScrollable = container.scrollHeight > container.clientHeight + 1;
      // True if the user is NOT at the bottom (allowing for 1px rounding error)
      const notAtBottom = container.scrollTop + container.clientHeight < container.scrollHeight - 1;
      setScrollable(isScrollable && notAtBottom);
    }
  }

  // Scroll to the bottom of the chat container
  const onScrollArrowClick = () => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Update scroll state when selected chat changes
  useEffect(() => {
    // If new chat, set scrollable to false
    if (getCurrentChatHistory().chatItems.length === 0) {
      setScrollable(false);
    }

    setTimeout(() => {
      // Check if we need to show scroll arrow after chat change
      handleScroll();

      // Always scroll to top when changing chats or refreshing the page
      if (chatRef.current) {
        chatRef.current.scrollTo({
          top: 0,
          behavior: "auto",
        });
      }

    }, 100); // Slight delay to allow DOM to update
  }, [currentChatIndex, getCurrentChatHistory]);

  const sendMessage = (question: string, attachments: Attachment[]) => {
    apiRequestService.makeApiRequest(
      question,
      userData,
      attachments,
      undefined,
      getEffectiveEnabledTools()
    )
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


  const loadChatHistoriesFromStorage = useCallback(() => {
    // No-op: store hydrates itself at creation
    if (!getCurrentChatHistory()) {
      setDefaultChatHistory();
    }
  }, [getCurrentChatHistory, setDefaultChatHistory]);


  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: "/",
    });
  };

  console.log("RENDER MainScreen");

  // Scrolls the last updated message (if its streaming, or once done) into view
  useEffect(() => {
    chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentChatHistory.uuid, currentChatHistory.chatItems]);

  // Load chat histories and persisted tools if present
  useEffect(() => {
    loadChatHistoriesFromStorage();
  }, [loadChatHistoriesFromStorage]);

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
    const updatedTools: Record<string, boolean> = {
      ...enabledTools,
    };
    const toolIsTurningOn: boolean =
      forceOn == true ? true : !enabledTools[name];

    // Finally, update the specific tool's state
    updatedTools[name] = toolIsTurningOn;

    // Update the app store with the new enabled tools
    setEnabledTools(updatedTools);

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

  // userData is now provided by App via context; no local fetch here

  const parsedSuggestionContext: ParsedSuggestionContext | null =
    location.state;
  const processedSuggestionRef = useRef<string | null>(null);
  useEffect(() => {
    // on initial load of page, if state is not null, log the state
    if (parsedSuggestionContext) {
      let uniqueKey: string;
      if (parsedSuggestionContext.success) {
        const ctx = parsedSuggestionContext.context;
        if (ctx && ctx.success) {
          type SuggestionContextSuccess = Extract<SuggestionContext, { success: true }>;
          uniqueKey = (ctx as SuggestionContextSuccess).original_query;
        } else {
          uniqueKey = "context-success-but-no-original-query";
        }
      } else {
        uniqueKey = `error-${parsedSuggestionContext.errorReason}`;
      }
      if (processedSuggestionRef.current === uniqueKey) {
        return; // already handled this context
      }
      processedSuggestionRef.current = uniqueKey;
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
          showSnackbar(
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
  }, [
    parsedSuggestionContext,
    showSnackbar,
    chatHistoriesDescriptions,
    chatService,
    getDefaultModel,
    setChatHistoriesDescriptions,
    setCurrentChatHistory,
  ]);

  const onSuggestionClicked = (
    question: string,
    tool: string,
    isStatic: boolean
  ) => {
    const updatedTools: Record<string, boolean> = {
      ...enabledTools,
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

  setEnabledTools(updatedTools);
    PersistenceUtils.setEnabledTools(updatedTools);
    apiRequestService.makeApiRequest(
      question,
      userData,
      undefined,
      undefined,
      getEffectiveEnabledTools(updatedTools)
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
                  id="open-drawer-button"
                  sx={{
                    color: "white",
                  }}
                  onClick={() => toggleAppDrawer()}
                  aria-label={tt("drawer.icon.title")}
                  title={tt("drawer.icon.title")}
                >
                  <VerticalSplitIcon />
                </IconButton>
              </>
            }
            enabledTools={enabledTools}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
            handleSelectedModelChanged={hanldeUpdateModelVersion}
            selectedModel={currentChatHistory.model}
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
              <Suggestions
                onSuggestionClicked={onSuggestionClicked}
                tools={Object.keys(enabledTools).filter(
                  (tool) => enabledTools[tool]
                )}
                regenerateKey={currentChatHistory.uuid}
              />
              <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={apiRequestService.isLoading}
                onSend={sendMessage}
                onStop={stopChat}
                quotedText={quotedText}
                selectedModel={currentChatHistory.model}
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
              left: appDrawerIsOpen ? LEFT_MENU_WIDTH : 0,
              right: 0,
              bottom: 0,
              paddingTop: "3rem",
            }}
          >
            <Box sx={{ flexGrow: 1 }}></Box>
            <ChatMessagesContainer
              chatHistory={currentChatHistory}
              isLoading={apiRequestService.isLoading}
              replayChat={replayChat}
              handleRemoveToastMessage={handleRemoveToastMessage}
              handleBookReservation={handleBookReservation}
              containerRef={chatRef}
              lastCompletionRef={lastCompletionRef}
              handleScroll={handleScroll}
              onScrollArrowClick={onScrollArrowClick}
              scrollable={scrollable}
            />
            <div style={{ height: "50px" }} />
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
                selectedModel={currentChatHistory.model}
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

export default memo(MainScreen);
