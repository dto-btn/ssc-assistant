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
import MenuIcon from "@mui/icons-material/Menu";
import NewLayout from "../../components/layouts/NewLayout";
import { useChatStore } from "../../stores/ChatStore";
import { PersistenceUtils } from "../../util/persistence";
import { useChatService } from "../../hooks/useChatService";
import { useApiRequestService } from "./useApiRequestService";
import { defaultEnabledTools } from "../../allowedTools";

const MainScreen = () => {
  const { t } = useTranslation();
  const appStore = useAppStore();
  const { currentChatIndex, currentChatHistory, chatHistoriesDescriptions, setCurrentChatHistory, setDefaultChatHistory, getDefaultModel, setCurrentChatIndex: chatStoreSetCurrentChatIndex, setChatHistoriesDescriptions, quotedText } = useChatStore();
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
      setDefaultChatHistory()
    }
  };

  const handleClearChat = () => {
    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [],
      };
      chatService.saveChatHistories(updatedChatHistory);
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
      appStore.tools.setEnabledTools(enabledTools);
    } else {
      appStore.tools.setEnabledTools(defaultEnabledTools);
    }
    const selectedCorporateFunction = PersistenceUtils.getSelectedCorporateFunction();
    if (selectedCorporateFunction)
      appStore.tools.setSelectedCorporateFunction(selectedCorporateFunction);
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

  const handleUpdateEnabledTools = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, checked } = event.target;
    let updatedTools;

    if (name === "archibus" && checked) {
      // If 'archibus' is enabled, set all other tools to off
      updatedTools = Object.keys(appStore.tools.enabledTools).reduce(
        (acc: { [key: string]: boolean }, tool: string) => {
          acc[tool] = tool === "archibus";
          return acc;
        },
        {}
      );
      // disable the function being used
      // (should have no incidence on backend but this is to make it clear to the user)
      appStore.tools.setSelectedCorporateFunction("none");
      PersistenceUtils.clearSelectedCorporateFunction();
    } else if (name !== "archibus" && checked) {
      // If any tool other than 'archibus' is enabled, set 'archibus' to off
      updatedTools = {
        ...appStore.tools.enabledTools,
        [name]: checked,
        archibus: false,
      };
    } else {
      // Otherwise, just update the specific tool's state
      updatedTools = {
        ...appStore.tools.enabledTools,
        [name]: checked,
      };
    }
    appStore.tools.setEnabledTools(updatedTools);
    PersistenceUtils.setEnabledTools(updatedTools);
  };

  const handleSetSelectedCorporateFunction = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    //https://mui.com/material-ui/react-radio-button/
    let functionName = (event.target as HTMLInputElement).value;
    appStore.tools.setSelectedCorporateFunction(functionName);
    PersistenceUtils.setSelectedCorporateFunction(functionName);
    // disable Archibus if it's checked and on...
    const _enabledTools = { ...appStore.tools.enabledTools };

      if (functionName == "none") {
        _enabledTools["corporate"] = false;
      } else {
        _enabledTools["corporate"] = true;
      }
    if (_enabledTools.hasOwnProperty("archibus")) {
      _enabledTools["archibus"] = false;
      }
    PersistenceUtils.setEnabledTools(_enabledTools);
    appStore.tools.setEnabledTools(_enabledTools);
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
          appStore.snackbars.show(msg, SNACKBAR_DEBOUNCE_KEYS.SUGGEST_CONTEXT_ERROR);
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
                }} onClick={() => appStore.appDrawer.toggle()}>
                  <MenuIcon />
                </IconButton>
              </>
            }
            handleSetSelectedCorporateFunction={handleSetSelectedCorporateFunction}
            selectedCorporateFunction={appStore.tools.selectedCorporateFunction}
            enabledTools={appStore.tools.enabledTools}
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
            handleLoadSavedChat={chatService.handleLoadSavedChat}
            renameChat={chatService.renameChat}
            onNewChat={chatService.handleNewChat}
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
                disabled={apiRequestService.isLoading}
                onSend={(question, attachments) =>
                  apiRequestService.makeApiRequest(question, userData, attachments, undefined, appStore.tools.enabledTools)
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
                left: appStore.appDrawer.isOpen ? LEFT_MENU_WIDTH : 0,
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
                  apiRequestService.makeApiRequest(question, userData, attachments, undefined, appStore.tools.enabledTools)
                }
                quotedText={quotedText}
                selectedModel={currentChatHistory.model}
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
