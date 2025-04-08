import { create } from 'zustand';
import { produce } from 'immer'

type ChatStore = {
    currentChatIndex: number,
    currentChatHistory: ChatHistory,
    setCurrentChatHistory: (param: ChatHistory | ((prev: ChatHistory) => ChatHistory)) => void;
    setDefaultChatHistory: () => void;
    getDefaultModel: () => string;
    setCurrentChatIndex: (index: number) => void;
};

const buildDefaultModel = () => {
    return "gpt-4o";
}


const buildDefaultChatHistory = () => {
    const defaultChatHistory: ChatHistory = {
        chatItems: [],
        description: "",
        uuid: "",
        model: buildDefaultModel(),
    };
    return defaultChatHistory
}

export const useChatStore = create<ChatStore>((set) => ({
    currentChatIndex: 0,
    currentChatHistory: buildDefaultChatHistory(),
    setCurrentChatHistory: (param: ChatHistory | ((prev: ChatHistory) => ChatHistory)) => {
        set((state) => produce(state, (draft) => {
            if (typeof param === "function") {
                draft.currentChatHistory = param(draft.currentChatHistory);
            } else {
                draft.currentChatHistory = param;
            }
        }));
    },
    setDefaultChatHistory: () => {
        set((state) => produce(state, (draft) => {
            draft.currentChatHistory = buildDefaultChatHistory();
        }));
    },
    getDefaultModel: () => {
        return buildDefaultModel();
    },
    setCurrentChatIndex: (index: number) => {
        set((state) => produce(state, (draft) => {
            draft.currentChatIndex = index;
        }));
    }
}));