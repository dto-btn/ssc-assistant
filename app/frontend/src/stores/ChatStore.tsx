import { create } from "zustand";
import { produce } from "immer";
import { buildDefaultChatHistory, buildDefaultModel } from "./modelBuilders";

type ChatStore = {
  currentChatIndex: number;
  currentChatHistory: ChatHistory | undefined;
  chatHistoriesDescriptions: string[];
  chatIndexToLoadOrDelete: number | null;
  quotedText: string | undefined;
  setChatIndexToLoadOrDelete: (index: number | null) => void;
  getCurrentChatHistory: () => ChatHistory;
  setCurrentChatHistory: (
    param: ChatHistory | ((prev: ChatHistory) => ChatHistory)
  ) => void;
  setDefaultChatHistory: () => void;
  getDefaultModel: () => string;
  setCurrentChatIndex: (index: number) => void;
  setChatHistoriesDescriptions: (descriptions: string[]) => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  currentChatIndex: 0,
  chatIndexToLoadOrDelete: null,
  currentChatHistory: buildDefaultChatHistory(),
  chatHistoriesDescriptions: ["Conversation 1"],
  quotedText: undefined,
  setChatIndexToLoadOrDelete: (index: number | null) => {
    set((state) =>
      produce(state, (draft) => {
        draft.chatIndexToLoadOrDelete = index;
      })
    );
  },
  setCurrentChatHistory: (
    param: ChatHistory | ((prev: ChatHistory) => ChatHistory)
  ) => {
    set((state) =>
      produce(state, (draft) => {
        if (typeof param === "function") {
          draft.currentChatHistory = param(draft.getCurrentChatHistory());
        } else {
          draft.currentChatHistory = param;
        }
      })
    );
  },
  setDefaultChatHistory: () => {
    set((state) =>
      produce(state, (draft) => {
        draft.currentChatHistory = buildDefaultChatHistory();
      })
    );
  },
  getDefaultModel: () => {
    return buildDefaultModel();
  },
  getCurrentChatHistory: () => {
    const state = get();
    const currentChatHistory = state.currentChatHistory;
    if (!currentChatHistory) {
      return buildDefaultChatHistory();
    } else {
      // We are spreading the defaultChatHistory because a lot of the time, we are losing keys from localstorage.
      // This is a hacky fix for now. We want to move to database persistence later anyway.
      return {
        ...buildDefaultChatHistory(),
        ...currentChatHistory
      }
    }
  },
  setCurrentChatIndex: (index: number) => {
    set((state) =>
      produce(state, (draft) => {
        draft.currentChatIndex = index;
      })
    );
  },
  setChatHistoriesDescriptions: (descriptions: string[]) => {
    set((state) =>
      produce(state, (draft) => {
        draft.chatHistoriesDescriptions = descriptions;
      })
    );
  },
}));
