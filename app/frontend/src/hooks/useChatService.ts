import { useMemo } from "react"
import { PersistenceUtils } from "../util/persistence";
import { useChatStore } from "../stores/ChatStore";
import { useAppStore } from "../stores/AppStore";
import { useTranslation } from "react-i18next";
import { MAX_CHAT_HISTORIES_LENGTH, SNACKBAR_DEBOUNCE_KEYS } from "../constants";
import { isACompletion } from "../utils";
import { buildDefaultChatHistory } from "../stores/modelBuilders";

export const useChatService = () => {
    const { t } = useTranslation()
    const chatStore = useChatStore();
    const snackbars = useAppStore((state) => state.snackbars);
    const appStore = useAppStore();
    const { currentChatIndex, chatHistoriesDescriptions, setChatIndexToLoadOrDelete, setChatHistoriesDescriptions, setDefaultChatHistory, setCurrentChatHistory, setCurrentChatIndex: chatStoreSetCurrentChatIndex } = useChatStore();
    // This is a custom hook that provides chat-related services. We use useMemo to
    // memoize the value of the service to avoid unnecessary re-renders.

    const setCurrentChatIndex = (index: number) => {
        // Set the index in local storage
        PersistenceUtils.setCurrentChatIndex(index);
        // Update the state
        chatStoreSetCurrentChatIndex(index);
    }

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
                    SNACKBAR_DEBOUNCE_KEYS.STORAGE_FULL_ERROR
                );
            }
            console.error("Failed to save to localStorage:", error);
        }
    }

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

    const handleLoadSavedChat = (index: number) => {
        const chatHistories = PersistenceUtils.getChatHistories();
        if (chatHistories) {
            const newChat = chatHistories[index];
            setCurrentChatHistory(newChat);
            setCurrentChatIndex(index);
        }
    };

    const handleNewChat = (tool?: string) => {
        const chatHistories = PersistenceUtils.getChatHistories();
        const newChatIndex = chatHistoriesDescriptions.length;
        if (chatHistories.length === MAX_CHAT_HISTORIES_LENGTH || newChatIndex >= MAX_CHAT_HISTORIES_LENGTH) {
            snackbars.show(
                t("chat.history.full"),
                SNACKBAR_DEBOUNCE_KEYS.CHAT_HISTORY_FULL_ERROR
            );
        } else {
            const newChat = buildDefaultChatHistory()
            chatHistories.push(newChat);
            const newDescription = "Conversation " + (chatHistoriesDescriptions.length + 1);
            newChat.description = newDescription;
            PersistenceUtils.setChatHistories(chatHistories);
            setCurrentChatIndex(chatHistories.length - 1);
            setCurrentChatHistory(newChat);
            setChatHistoriesDescriptions([
                ...chatHistoriesDescriptions,
                newDescription
            ]);

            // Process tools for this new chat
            let updatedTools: Record<string, boolean> = {
                ...appStore.tools.enabledTools,
            };
            Object.keys(appStore.tools.enabledTools).forEach((t) => {
                updatedTools[t] = false;
            });
            if(tool){
                if (tool && (tool === "archibus" || tool === "bits")) {
                    Object.keys(appStore.tools.enabledTools).forEach((t) => {
                        updatedTools[t] = false;
                    });
                }
                updatedTools[tool] = true;
            } else {
                updatedTools['corporate'] = true;
                updatedTools['geds'] = true;
            }
            appStore.tools.setEnabledTools(updatedTools);
            PersistenceUtils.setEnabledTools(updatedTools);
        }
    };

    const deleteAllChatHistory = () => {
        // create a new chat history with default values
        const newChat = buildDefaultChatHistory()
        const newDescription = "Conversation 1";
        newChat.description = newDescription;

        // update the in-memory state
        setChatHistoriesDescriptions([newDescription]);
        setCurrentChatHistory(newChat);
        setCurrentChatIndex(0);
        
        // update the persisted state
        PersistenceUtils.setChatHistories([newChat]);
        PersistenceUtils.setCurrentChatIndex(0);
    }

    const memoized = useMemo(() => {
        return {
            setCurrentChatIndex,
            saveChatHistories,
            renameChat,
            handleLoadSavedChat,
            handleNewChat,
            deleteSavedChat: async (chatIndexToLoadOrDelete: number) => {
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
            },
            updateLastMessage(message_chunk: string) {
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
            },
            deleteAllChatHistory
        }
    }, [chatStore, snackbars])

    return memoized
}