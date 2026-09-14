import { v4 as uuidv4 } from "uuid";
import { DEFAULT_CHAT_MODEL } from "../constants/models";

export const buildDefaultModel = () => {
    return DEFAULT_CHAT_MODEL
}


export const buildDefaultChatHistory = () => {
    const now = new Date().toISOString();
    const defaultChatHistory: ChatHistory = {
        chatItems: [],
        description: "",
        uuid: uuidv4(),
        model: buildDefaultModel(),
        createdAt: now,
        updatedAt: now,
        isTopicSet: false, // Default value for isTopicSet
        staticTools: [] // Default value for staticTools
    };
    return defaultChatHistory
}