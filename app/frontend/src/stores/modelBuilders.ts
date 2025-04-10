import { DEFAULT_CHAT_MODEL } from "../constants/models";

export const buildDefaultModel = () => {
    return DEFAULT_CHAT_MODEL
}


export const buildDefaultChatHistory = () => {
    const defaultChatHistory: ChatHistory = {
        chatItems: [],
        description: "",
        uuid: "",
        model: buildDefaultModel(),
    };
    return defaultChatHistory
}