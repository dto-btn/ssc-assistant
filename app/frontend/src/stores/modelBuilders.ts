import { v4 as uuidv4 } from "uuid";
import { DEFAULT_CHAT_MODEL } from "../constants/models";

export const buildDefaultModel = () => {
    return DEFAULT_CHAT_MODEL
}


export const buildDefaultChatHistory = () => {
    const defaultChatHistory: ChatHistory = {
        chatItems: [],
        description: "",
        uuid: uuidv4(),
        model: buildDefaultModel(),
        isTopicSet: false, // Default value for isTopicSet
    };
    return defaultChatHistory
}