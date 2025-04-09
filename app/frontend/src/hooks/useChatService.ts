import { useMemo } from "react"
import { PersistenceUtils } from "../util/persistence";
import { useChatStore } from "../stores/ChatStore";

export const useChatService = () => {
    const chatStore = useChatStore();
    const { currentChatIndex, setChatIndexToLoadOrDelete, setChatHistoriesDescriptions, setDefaultChatHistory, setCurrentChatHistory, setCurrentChatIndex } = useChatStore();
    // This is a custom hook that provides chat-related services. We use useMemo to
    // memoize the value of the service to avoid unnecessary re-renders.
    const memoized = useMemo(() => {
        return {
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
            }
        }
    }, [chatStore])

    return memoized
}