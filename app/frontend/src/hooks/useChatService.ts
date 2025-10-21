
import { useCallback, useMemo } from "react"

import { PersistenceUtils } from "../util/persistence";
import { useChatStore } from "../stores/ChatStore";
import { useAppStore } from "../stores/AppStore";
import { useTranslation } from "react-i18next";
import { MAX_CHAT_HISTORIES_LENGTH, MUTUALLY_EXCLUSIVE_TOOLS, SNACKBAR_DEBOUNCE_KEYS } from "../constants";
import { isACompletion } from "../utils";
import { buildDefaultChatHistory } from "../stores/modelBuilders";
import { useBasicApiRequestService } from "../screens/MainScreen/useApiRequestService";
// removed duplicate t import; using useTranslation hook's t

let hasFetchedTitle = false

export const useChatService = () => {
    const { t } = useTranslation()
    // Select only what's needed from stores to avoid re-renders on unrelated updates
    const currentChatIndex = useChatStore((s) => s.currentChatIndex);
    const chatHistoriesDescriptions = useChatStore((s) => s.chatHistoriesDescriptions);
    const setChatIndexToLoadOrDelete = useChatStore((s) => s.setChatIndexToLoadOrDelete);
    const setChatHistoriesDescriptions = useChatStore((s) => s.setChatHistoriesDescriptions);
    const setDefaultChatHistory = useChatStore((s) => s.setDefaultChatHistory);
    const setCurrentChatHistory = useChatStore((s) => s.setCurrentChatHistory);
    const chatStoreSetCurrentChatIndex = useChatStore((s) => s.setCurrentChatIndex);

    const showSnackbar = useAppStore((s) => s.snackbars.show);
    const enabledTools = useAppStore((s) => s.tools.enabledTools);
    const setAppEnabledTools = useAppStore((s) => s.tools.setEnabledTools);
    const messageThreshold = parseInt(import.meta.env.TITLE_RENAME_THRESHOLD || "1", 10);

    const makeBasicApiRequest = useBasicApiRequestService();
    // This is a custom hook that provides chat-related services. We use useMemo to
    // memoize the value of the service to avoid unnecessary re-renders.

    const setCurrentChatIndex = useCallback((index: number) => {
        // Set the index in local storage
        PersistenceUtils.setCurrentChatIndex(index);
        // Update the state
        chatStoreSetCurrentChatIndex(index);
    }, [chatStoreSetCurrentChatIndex]);


    const fetchChatTitleAndRename = useCallback(async (
        updatedChatHistory: { chatItems: ChatItem[] }, // Structure of chat history passed to the function
        currentChatIndex: number,                 // Index of the conversation being updated
        renameChat: (title: string, index: number) => void,
         // Callback to rename the conversation                     // Authorization token

    ): Promise<void> => {
        /**
         * Fetches a title for the chat conversation using the completionBasic function
         * and renames the chat using the provided renameChat callback.
         *
         * @param updatedChatHistory - The current chat history to be updated.
         * @param currentChatIndex - The index of the current chat in the chat history.
         * @param renameChat - Callback function to rename the chat with the new title.
         */
        try {

            const message :Message[] = updatedChatHistory.chatItems.map((item) => {
                // Ensure each chat item is a Message type
                if (isACompletion(item)) {
                    return item.message; // Extract the message from the completion
                }
                return item as Message; // Cast to Message type
            }).filter((item) => {
                // Filter out any undefined or null items
                return item !== null && item !== undefined;
            }).map((item) => {
                // Ensure each item has a role and content
                return {
                    role: item.role || "system", // Default to "system" if role is undefined
                    content: item.content || "", // Default to empty string if content is undefined
                    context: item.context, // Include context if available
                    tools_info: item.tools_info, // Include tools_info if available
                    quotedText: item.quotedText, // Include quotedText if available
                    attachments: item.attachments // Include attachments if available
                };
            });

            // Construct the MessageRequest object
            const request: MessageRequest = summerizeChatWithChatGPT(message, t);

            // Call the completionBasic function
            const data = await makeBasicApiRequest(request);

            // Extract the title from the response or use a fallback if unavailable
            const title = data.json.message.content || `Conversation ${currentChatIndex + 1}`;

            // Apply the title to the current chat using the provided callback
            renameChat(title, currentChatIndex);
        } catch (error) {
            console.error("Error fetching chat title:", error);

            // Provide a fallback title in case of an error
            renameChat(`Conversation ${currentChatIndex + 1}`, currentChatIndex);
        }
    }, [makeBasicApiRequest, t]);
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
        const newChatIndex = chatHistoriesDescriptions.length;

        if (chatHistories.length === MAX_CHAT_HISTORIES_LENGTH || newChatIndex >= MAX_CHAT_HISTORIES_LENGTH) {
            showSnackbar(
                t("chat.history.full"),
                SNACKBAR_DEBOUNCE_KEYS.CHAT_HISTORY_FULL_ERROR
            );
        } else {
            const newChat = buildDefaultChatHistory()
            chatHistories.push(newChat);
            const newDescription = "...";

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
            setChatHistoriesDescriptions([
                ...chatHistoriesDescriptions,
                newDescription
            ]);
            setAppEnabledTools(updatedTools);
            PersistenceUtils.setEnabledTools(updatedTools);

        }
    }, [chatHistoriesDescriptions, enabledTools, setAppEnabledTools, setChatHistoriesDescriptions, setCurrentChatHistory, setCurrentChatIndex, showSnackbar, t]);

        const handleNewChat = useCallback((tool?: string) => {
                const chatHistories = PersistenceUtils.getChatHistories();
                    let chatIndex = chatHistories.length - 1;
            if(chatIndex < 0){
                chatIndex = 0;
            }
                const lastChat = (chatHistories[chatIndex] as ChatHistory) || buildDefaultChatHistory();
                const lastChatLength = Array.isArray(lastChat.chatItems) ? lastChat.chatItems.length : 0;

        if(lastChatLength === 0 && typeof(tool) !== "undefined"){
            deleteSavedChat(chatIndex);
            createNewChat(tool);
            window.location.reload();
        }else if(lastChatLength === 0 && lastChat.staticTools?.length > 0){
            deleteSavedChat(chatIndex);
            createNewChat(tool);
            window.location.reload();
        }else if(lastChatLength != 0 || typeof(tool) !== "undefined"){
            createNewChat(tool);
        }else{
            //set chat index to first chat
            setCurrentChatIndex(chatIndex);
            const currentChat = chatHistories[chatIndex];
            setCurrentChatHistory(currentChat);
            window.location.reload();
        }
    }, [createNewChat, deleteSavedChat, setCurrentChatHistory, setCurrentChatIndex])


    const deleteAllChatHistory = useCallback(() => {
        // create a new chat history with default values
        const newChat = buildDefaultChatHistory()
        const newDescription = "...";
        newChat.description = newDescription;

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
            showSnackbar(t("settings.export.success"));
        } catch (error) {
            console.error("Failed to export chat histories:", error);
            showSnackbar(t("settings.export.error"), SNACKBAR_DEBOUNCE_KEYS.EXPORT_CHAT_ERROR);
        }
    }, [showSnackbar, t]);

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
                            try{
                            //Fetch and set the chat title using the reusable function
                            fetchChatTitleAndRename(updatedChatHistory, currentChatIndex, renameChat);
                            }catch(error){
                                console.error("Error fetching chat title:", error);
                            }finally{
                                hasFetchedTitle = true; // Ensure we only fetch the title once per conversation
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
        fetchChatTitleAndRename,
        messageThreshold,
        currentChatIndex,
        setCurrentChatHistory,
        exportChatHistories,
    ])

    return memoized
}

function mergeChatItem(chatItem: { role?: string; content?: unknown }): string {
    /**
     * Merges a chat item into a string format for logging or display.
     */
    if (!chatItem) {
        return "";
    }

    let role: string = chatItem.role ?? "unknown"; // Default 'role' to "unknown" if undefined
    let content: unknown = chatItem.content ?? ""; // Default 'content' to an empty string if undefined

    // Handle content based on its type
    if (typeof content === "object" && content !== null && !Array.isArray(content)) {
        // Convert content to JSON string if it's an object
        content = JSON.stringify(content as Record<string, unknown>, null, 0); // No extra spaces
    } else if (Array.isArray(content)) {
        // Join array items with newline characters
        content = (content as unknown[]).map(item => String(item)).join("\n");
    } else if (typeof content !== "string") {
        // Convert non-string, non-object, non-array content to a string
        content = String(content);
    }

    // Ensure 'role' is a string
    if (typeof role !== "string") {
        role = String(role);
    }

    // Normalize to string for final checks
    const contentStr = typeof content === "string" ? content : String(content);
    // Skip invalid chat items
    if (role === "unknown" || !contentStr || !contentStr.trim()) {
        return "";
    }

    // Strip leading and trailing whitespace from the content
    content = contentStr.trim();

    // Return the formatted string
    return `${role}: ${content}`;
}

function summerizeChatWithChatGPT(chat: Message[], t: (key: string) => string): MessageRequest {
    // Merge all chat items (filter undefined or null items)
    const mergeChatItems = chat
        .filter(item => item !== null && item !== undefined)
        .map(item => mergeChatItem(item));

    // Join merged chat items into a single block of text
    const mergedText = mergeChatItems.join("\n");

    // Build the prompt for ChatGPT
    const SUMMERIZECHATWITHCHATGPT_MESSAGE = t("summerize.conversation");
    const prompt = `${SUMMERIZECHATWITHCHATGPT_MESSAGE}:\n\n${mergedText}`;

    // Create a request message
    const messages: Message[] = [{ role: "user", content: prompt }];
    const messageRequest: MessageRequest = {
        messages: messages,
        query: prompt,
        quotedText: "",
        model: import.meta.env.TITLE_RENAME_MODEL || "gpt-4.1-nano",
    };

    return messageRequest;
}

