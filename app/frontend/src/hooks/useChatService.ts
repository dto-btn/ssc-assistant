import { useCallback, useMemo } from "react"

import { PersistenceUtils } from "../util/persistence";
import { useChatStore } from "../stores/ChatStore";
import { useAppStore } from "../stores/AppStore";
import { useTranslation } from "react-i18next";
import { MAX_CHAT_HISTORIES_LENGTH, MUTUALLY_EXCLUSIVE_TOOLS, SNACKBAR_DEBOUNCE_KEYS } from "../constants";
import { isACompletion, isAMessage } from "../utils";
import { buildDefaultChatHistory } from "../stores/modelBuilders";
// removed duplicate t import; using useTranslation hook's t

let hasFetchedTitle = false

export const useChatService = () => {
    const { t } = useTranslation()
    // Select only what's needed from stores to avoid re-renders on unrelated updates
    const currentChatIndex = useChatStore((s) => s.currentChatIndex);
    const setChatIndexToLoadOrDelete = useChatStore((s) => s.setChatIndexToLoadOrDelete);
    const setChatHistoriesDescriptions = useChatStore((s) => s.setChatHistoriesDescriptions);
    const setDefaultChatHistory = useChatStore((s) => s.setDefaultChatHistory);
    const setCurrentChatHistory = useChatStore((s) => s.setCurrentChatHistory);
    const chatStoreSetCurrentChatIndex = useChatStore((s) => s.setCurrentChatIndex);
    const hydrateChatStore = useChatStore((s) => s.hydrateOnBoot);

    const showSnackbar = useAppStore((s) => s.snackbars.show);
    const enabledTools = useAppStore((s) => s.tools.enabledTools);
    const setAppEnabledTools = useAppStore((s) => s.tools.setEnabledTools);
    const messageThreshold = parseInt(import.meta.env.TITLE_RENAME_THRESHOLD || "1", 10);

    // This is a custom hook that provides chat-related services. We use useMemo to
    // memoize the value of the service to avoid unnecessary re-renders.

    const setCurrentChatIndex = useCallback((index: number) => {
        // Set the index in local storage
        PersistenceUtils.setCurrentChatIndex(index);
        // Update the state
        chatStoreSetCurrentChatIndex(index);
    }, [chatStoreSetCurrentChatIndex]);

    const saveChatHistories = useCallback((updatedChatHistory: ChatHistory) => {

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
                showSnackbar(
                    t("storage.full"),
                    SNACKBAR_DEBOUNCE_KEYS.STORAGE_FULL_ERROR
                );
            }
            console.error("Failed to save to localStorage:", error);
            return Promise.reject(error);
        }
        return Promise.resolve(updatedChatHistory);
    }, [currentChatIndex, showSnackbar, t]);

    const renameChat = useCallback((newDescription: string, indexToUpdate: number) => {
        const chatHistories = PersistenceUtils.getChatHistories();
        const updatedChatHistories = [...chatHistories];
        const updatedChatHistory: ChatHistory = {
            ...chatHistories[indexToUpdate],
            description: newDescription,
            isTopicSet: true,
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
    }, [currentChatIndex, setChatHistoriesDescriptions, setCurrentChatHistory]);

    const handleLoadSavedChat = useCallback((index: number) => {
        const chatHistories = PersistenceUtils.getChatHistories();
        if (chatHistories) {
            // Reset auto-title state when switching chats.
            hasFetchedTitle = false;
            const newChat = chatHistories[index];
            setCurrentChatHistory(newChat);
            setCurrentChatIndex(index);
        }
    }, [setCurrentChatHistory, setCurrentChatIndex]);

    // Memoized delete to keep stable reference in other hooks
    const deleteSavedChat = useCallback(async (chatIndexToLoadOrDelete: number) => {
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
    }, [currentChatIndex, setChatHistoriesDescriptions, setChatIndexToLoadOrDelete, setCurrentChatHistory, setCurrentChatIndex, setDefaultChatHistory]);

    const createNewChat = useCallback((tool?: string) => {
        const chatHistories = PersistenceUtils.getChatHistories();
        // Always use persisted length to avoid duplicate sidebar titles.
        const newChatIndex = chatHistories.length;

        if (chatHistories.length === MAX_CHAT_HISTORIES_LENGTH || newChatIndex >= MAX_CHAT_HISTORIES_LENGTH) {
            showSnackbar(
                t("chat.history.full"),
                SNACKBAR_DEBOUNCE_KEYS.CHAT_HISTORY_FULL_ERROR
            );
        } else {
            const newChat = buildDefaultChatHistory()
            chatHistories.push(newChat);
            // Generate a stable fallback title for the new chat.
            const newDescription = getNextNewChatTitle(chatHistories);

            // Process tools (static tools are generally mutually exclusive tools and work on their own)
            // If tool(s) are enforced specifically here for this new chat, we set them in the convo staticTools
            // Process tools for this new chat
            const updatedTools: Record<string, boolean> = {
                ...enabledTools,
            };
            if (tool) {
                newChat.staticTools = [tool];
                Object.keys(enabledTools).forEach((t) => {
                        updatedTools[t] = t == tool;
                    });
            } else {// else we enable all other tools.
                Object.keys(enabledTools).forEach((t) => {
                    updatedTools[t] = !MUTUALLY_EXCLUSIVE_TOOLS.includes(t);
                });
            }
            newChat.description = newDescription;
            PersistenceUtils.setChatHistories(chatHistories);
            setCurrentChatIndex(chatHistories.length - 1);
            setCurrentChatHistory(newChat);
            // Allow auto-title for the newly created chat.
            hasFetchedTitle = false;
            // Rebuild descriptions from persisted histories to keep UI in sync.
            setChatHistoriesDescriptions(
                chatHistories.map(
                    (chatHistory, index) =>
                        chatHistory.description || "Conversation " + (index + 1)
                )
            );
            setAppEnabledTools(updatedTools);
            PersistenceUtils.setEnabledTools(updatedTools);

        }
    }, [enabledTools, setAppEnabledTools, setChatHistoriesDescriptions, setCurrentChatHistory, setCurrentChatIndex, showSnackbar, t]);

        const handleNewChat = useCallback(async (tool?: string) => {
                const chatHistories = PersistenceUtils.getChatHistories();
                    let chatIndex = chatHistories.length - 1;
            if(chatIndex < 0){
                chatIndex = 0;
            }
                const lastChat = (chatHistories[chatIndex] as ChatHistory) || buildDefaultChatHistory();
                const lastChatLength = Array.isArray(lastChat.chatItems) ? lastChat.chatItems.length : 0;

        if(lastChatLength === 0 && typeof(tool) !== "undefined"){
            // Ensure deletions complete before creating a new chat to avoid duplicates.
            await deleteSavedChat(chatIndex);
            createNewChat(tool);
        }else if(lastChatLength === 0 && lastChat.staticTools?.length > 0){
            // Same deletion-before-create logic for tool-specific chats.
            await deleteSavedChat(chatIndex);
            createNewChat(tool);
        }else if(lastChatLength != 0 || typeof(tool) !== "undefined"){
            createNewChat(tool);
        }else{
            //set chat index to first chat
            setCurrentChatIndex(chatIndex);
            const currentChat = chatHistories[chatIndex];
            setCurrentChatHistory(currentChat);
        }
    }, [createNewChat, deleteSavedChat, setCurrentChatHistory, setCurrentChatIndex])


    const deleteAllChatHistory = useCallback(() => {
        // create a new chat history with default values
        const newChat = buildDefaultChatHistory()
        const newDescription = getNextNewChatTitle([]);
        newChat.description = newDescription;
        // Reset auto-title state for the fresh chat.
        hasFetchedTitle = false;

        // update the in-memory state
        setChatHistoriesDescriptions([newDescription]);
        setCurrentChatHistory(newChat);
        setCurrentChatIndex(0);

        // update the persisted state
        PersistenceUtils.setChatHistories([newChat]);
        PersistenceUtils.setCurrentChatIndex(0);
    }, [setChatHistoriesDescriptions, setCurrentChatHistory, setCurrentChatIndex]);

    const exportChatHistories = useCallback(() => {
        try {
            PersistenceUtils.exportChatHistories();
            showSnackbar(t("settings.export.success"), undefined, "success");
        } catch (error) {
            console.error("Failed to export chat histories:", error);
            showSnackbar(t("settings.export.error"), SNACKBAR_DEBOUNCE_KEYS.EXPORT_CHAT_ERROR);
        }
    }, [showSnackbar, t]);

    const importChatHistories = useCallback(async (file: File) => {
        try {
            const { chatHistories, currentChatIndex } = await PersistenceUtils.importChatHistories(file);

            // Rehydrate each history with the latest defaults so legacy exports pick up new fields safely.
            const hydratedHistories = chatHistories.map((history, index) => ({
                ...buildDefaultChatHistory(),
                ...history,
                description: history.description && history.description.trim().length > 0
                    ? history.description
                    : `Conversation ${index + 1}`,
            }));

            const descriptions = hydratedHistories.map((chatHistory, index) =>
                chatHistory.description || `Conversation ${index + 1}`
            );

            const nextCurrentChatIndex = Math.min(Math.max(currentChatIndex, 0), hydratedHistories.length - 1);
            const nextCurrentChatHistory = hydratedHistories[nextCurrentChatIndex];

            hydrateChatStore({
                currentIndex: nextCurrentChatIndex,
                currentHistory: nextCurrentChatHistory,
                descriptions,
            });

            showSnackbar(t("settings.import.success"), undefined, "success");
        } catch (error) {
            console.error("Failed to import chat histories:", error);
            showSnackbar(t("settings.import.error"), SNACKBAR_DEBOUNCE_KEYS.IMPORT_CHAT_ERROR);
            throw error;
        }
    }, [hydrateChatStore, showSnackbar, t]);

    // old deleteSavedChat removed (now memoized above)

    const memoized = useMemo(() => {
        return {
            setCurrentChatIndex,
            saveChatHistories,
            renameChat,
            handleLoadSavedChat,
            handleNewChat,
            deleteSavedChat,
            exportChatHistories,
            importChatHistories,

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

                    saveChatHistories(updatedChatHistory).then(() => {
                        // Check if the message threshold is reached and the topic is not set
                        if (
                            updatedChatHistory.chatItems.length >= messageThreshold &&
                            updatedChatHistory.isTopicSet === false &&
                            !hasFetchedTitle
                        ) {
                            try {
                                // Only auto-title when the chat still has a default label.
                                if (shouldAutoRename(updatedChatHistory, currentChatIndex)) {
                                    const derivedTitle = buildTitleFromFirstMessage(updatedChatHistory.chatItems);
                                    if (derivedTitle) {
                                        renameChat(derivedTitle, currentChatIndex);
                                        hasFetchedTitle = true; // Ensure we only auto-title once per conversation
                                    }
                                }
                            } catch (error) {
                                console.error("Error generating chat title:", error);
                            }
                        }
                    });
                    return updatedChatHistory;
                });
            },
            deleteAllChatHistory
        }
    }, [
        setCurrentChatIndex,
        saveChatHistories,
        renameChat,
        handleLoadSavedChat,
        handleNewChat,
        deleteAllChatHistory,
        deleteSavedChat,
        messageThreshold,
        currentChatIndex,
        setCurrentChatHistory,
        exportChatHistories,
        importChatHistories,
    ])

    return memoized
}

/**
 * Provides a stable fallback title for new chats: "New Chat N".
 *
 * Uses existing persisted histories to increment the counter safely.
 */
function getNextNewChatTitle(chatHistories: ChatHistory[]): string {
    const prefix = "New Chat";
    let maxIndex = 0;

    for (const history of chatHistories) {
        const description = typeof history.description === "string" ? history.description.trim() : "";
        if (!description.startsWith(prefix)) {
            continue;
        }

        const match = description.match(/^New Chat\s*(\d+)$/i);
        if (match) {
            const value = Number.parseInt(match[1], 10);
            if (!Number.isNaN(value)) {
                maxIndex = Math.max(maxIndex, value);
            }
        }
    }

    return `${prefix} ${maxIndex + 1}`;
}
/**
 * Determines whether a chat can be auto-titled.
 *
 * Skips auto-renaming if the user has already renamed the chat or
 * if a title has been explicitly set.
 */
function shouldAutoRename(chatHistory: ChatHistory, chatIndex: number): boolean {
    if (chatHistory.isTopicSet) {
        return false;
    }

    const description = (chatHistory.description || "").trim();
    if (!description || description === "...") {
        return true;
    }

    const defaultTitle = `Conversation ${chatIndex + 1}`;
    if (description === defaultTitle) {
        return true;
    }

    // Treat "New Chat N" placeholders as auto-renamable defaults.
    return /^New Chat\s*\d+$/i.test(description);
}

/**
 * Builds a short chat title from the first non-empty message content.
 *
 * This is intentionally simple and avoids AI-based renaming.
 */
function buildTitleFromFirstMessage(chatItems: ChatItem[], maxWords = 6): string | null {
    let normalized = "";
    for (const item of chatItems) {
        const content = isACompletion(item)
            ? item.message?.content
            : isAMessage(item)
                ? (item as Message).content
                : "";

        const candidate = typeof content === "string" ? content.trim() : String(content ?? "").trim();
        if (candidate) {
            normalized = candidate;
            break;
        }
    }

    if (!normalized) {
        return null;
    }

    const words = normalized.split(/\s+/).filter(Boolean);
    if (!words.length) {
        return null;
    }

    const truncated = words.slice(0, maxWords).join(" ");
    return words.length > maxWords ? `${truncated}…` : truncated;
}

