import { useEffect, useMemo } from "react"
import { PersistenceUtils } from "../util/persistence";
import { useChatStore } from "../stores/ChatStore";
import { useAppStore } from "../stores/AppStore";
import { useTranslation } from "react-i18next";
import { MAX_CHAT_HISTORIES_LENGTH, SNACKBAR_DEBOUNCE_KEYS } from "../constants";
import { isACompletion } from "../utils";
import { buildDefaultChatHistory } from "../stores/modelBuilders";
import { useBasicApiRequestService } from "../screens/MainScreen/useApiRequestService";
import { t } from "i18next";



export const useChatService = () => {
    const { t } = useTranslation()
    const chatStore = useChatStore();
    const snackbars = useAppStore((state) => state.snackbars);
    const appStore = useAppStore();
    const messageThreshold = 4;
    const makeBasicApiRequest = useBasicApiRequestService();
    const { currentChatIndex, chatHistoriesDescriptions, setChatIndexToLoadOrDelete, setChatHistoriesDescriptions, setDefaultChatHistory, setCurrentChatHistory, setCurrentChatIndex: chatStoreSetCurrentChatIndex } = useChatStore();
    // This is a custom hook that provides chat-related services. We use useMemo to
    // memoize the value of the service to avoid unnecessary re-renders.

    const setCurrentChatIndex = (index: number) => {
        // Set the index in local storage
        PersistenceUtils.setCurrentChatIndex(index);
        // Update the state
        chatStoreSetCurrentChatIndex(index);
    }

    const fetchChatTitleAndRename = async (
        updatedChatHistory: { chatItems: ChatItem[] }, // Structure of chat history passed to the function
        currentChatIndex: number,                 // Index of the conversation being updated
        renameChat: (title: string, index: number) => void, // Callback to rename the conversation                     // Authorization token
        
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
            const request: MessageRequest = summerizeChatWithChatGPT(message);

            // Call the completionBasic function
            const data = await makeBasicApiRequest(request);

            // Extract the title from the response or use a fallback if unavailable
            const title = data.message.content || `Conversation ${currentChatIndex + 1}`;

            // Apply the title to the current chat using the provided callback
            renameChat(title, currentChatIndex);
        } catch (error) {
            console.error("Error fetching chat title:", error);

            // Provide a fallback title in case of an error
            renameChat(`Conversation ${currentChatIndex + 1}`, currentChatIndex);
        }
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
                    SNACKBAR_DEBOUNCE_KEYS.STORAGE_FULL_ERROR
                );
            }
            console.error("Failed to save to localStorage:", error);
            return Promise.reject(error);
        }
        return Promise.resolve(updatedChatHistory);
    }

    const renameChat = (newDescription: string, indexToUpdate: number) => {
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
    };

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

                    saveChatHistories(updatedChatHistory).then(() => {
                        // Check if the message threshold is reached and the topic is not set
                        if (
                            updatedChatHistory.chatItems.length >= messageThreshold &&
                            updatedChatHistory.isTopicSet === false
                        ) {
                            //Fetch and set the chat title using the reusable function
                            fetchChatTitleAndRename(updatedChatHistory, currentChatIndex, renameChat);
                        }
                    });
                    return updatedChatHistory;
                });
            },
            deleteAllChatHistory
        }
    }, [chatStore, snackbars])

    return memoized
}

function mergeChatItem(chatItem: { role?: string; content?: any }): string {
    /**
     * Merges a chat item into a string format for logging or display.
     */
    if (!chatItem) {
        return "";
    }

    let role: string = chatItem.role ?? "unknown"; // Default 'role' to "unknown" if undefined
    let content: any = chatItem.content ?? ""; // Default 'content' to an empty string if undefined

    // Handle content based on its type
    if (typeof content === "object" && !Array.isArray(content)) {
        // Convert content to JSON string if it's an object
        content = JSON.stringify(content, null, 0); // No extra spaces
    } else if (Array.isArray(content)) {
        // Join array items with newline characters
        content = content.map(item => String(item)).join("\n");
    } else if (typeof content !== "string") {
        // Convert non-string, non-object, non-array content to a string
        content = String(content);
    }

    // Ensure 'role' is a string
    if (typeof role !== "string") {
        role = String(role);
    }

    // Skip invalid chat items
    if (role === "unknown" || !content || !content.trim()) {
        return "";
    }

    // Strip leading and trailing whitespace from the content
    content = content.trim();

    // Return the formatted string
    return `${role}: ${content}`;
}

function summerizeChatWithChatGPT(chat: Message[]): MessageRequest {
 

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
        model: "gpt-4.1-nano",
    };

    return messageRequest;
}

