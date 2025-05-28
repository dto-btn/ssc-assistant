import {
  Box,
  IconButton,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
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
import {
  SNACKBAR_DEBOUNCE_KEYS,
  LEFT_MENU_WIDTH,
  MUTEX_TOOLS,
} from "../../constants";
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
        appStore.tools.enabledTools
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

  const handleUpdateEnabledTools = (name: string) => {
    let updatedTools: Record<string, boolean> = {
      ...appStore.tools.enabledTools,
    };
    const toolIsTurningOn: boolean = !appStore.tools.enabledTools[name];

    // Archibus is mutually exclusive with all other tools. If 'archibus' is turned on,
    // all other tools should be disabled. On the other hand, if any other tool is turned on,
    // 'archibus' should be disabled.
    if (name === "archibus") {
      if (toolIsTurningOn) {
        // If 'archibus' is being turned on, make sure to set all other tools to off
        Object.keys(appStore.tools.enabledTools).forEach((tool) => {
          updatedTools[tool] = false;
        });
      }
    } else {
      // If any tool other than 'archibus' is enabled, set 'archibus' to off
      updatedTools.archibus = false;
    }

    // We have a category of tools that are mutually exclusive. If one of them is turned
    // on, all others should be turned off. This is a temporary hack until we refactor
    // the tools to be more modular.
    if (toolIsTurningOn && MUTEX_TOOLS.includes(name)) {
      MUTEX_TOOLS.forEach((tool) => {
        updatedTools[tool] = false;
      });
    }

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
              <Typography
                variant="body1"
                sx={{
                  maxWidth: "80%",
                  textAlign: "center",
                  mb: 4,
                }}
              >
                {t("how.can.i.help.submessage")}
              </Typography>
              <Suggestions
                apiRequestService={apiRequestService}
                userData={userData}
              />
              <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={apiRequestService.isLoading}
                onSend={(question, attachments) =>
                  apiRequestService.makeApiRequest(
                    question,
                    userData,
                    attachments,
                    undefined,
                    appStore.tools.enabledTools
                  )
                }
                quotedText={quotedText}
                selectedModel={getCurrentChatHistory().model}
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
              overflow: "auto",
            }}
            // maxWidth="lg"
          >
            <Box sx={{ flexGrow: 1 }}></Box>
            <ChatMessagesContainer
              chatHistory={getCurrentChatHistory()}
              isLoading={apiRequestService.isLoading}
              chatMessageStreamEnd={chatMessageStreamEnd}
              replayChat={replayChat}
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
                disabled={apiRequestService.isLoading}
                onSend={(question, attachments) =>
                  apiRequestService.makeApiRequest(
                    question,
                    userData,
                    attachments,
                    undefined,
                    appStore.tools.enabledTools
                  )
                }
                quotedText={quotedText}
                selectedModel={getCurrentChatHistory().model}
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
