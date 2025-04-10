import { isACompletion, isAMessage } from "../../utils";

export const convertChatHistoryToMessages = (chatHistory: ChatItem[], maxMessagesSent: number): Message[] => {
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