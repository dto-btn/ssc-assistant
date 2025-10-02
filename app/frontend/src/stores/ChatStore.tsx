import { create } from "zustand";
import { produce } from "immer";
import { buildDefaultChatHistory, buildDefaultModel } from "./modelBuilders";
import { PersistenceUtils } from "../util/persistence";

type ChatStore = {
  currentChatIndex: number;
  currentChatHistory: ChatHistory | undefined;
  chatHistoriesDescriptions: string[];
  chatIndexToLoadOrDelete: number | null;
  quotedText: string | undefined;
  setQuotedText: (text: string | undefined) => void;
  setChatIndexToLoadOrDelete: (index: number | null) => void;
  getCurrentChatHistory: () => ChatHistory;
  setCurrentChatHistory: (
    param: ChatHistory | ((prev: ChatHistory) => ChatHistory)
  ) => void;
  setDefaultChatHistory: () => void;
  getDefaultModel: () => string;
  setCurrentChatIndex: (index: number) => void;
  setChatHistoriesDescriptions: (descriptions: string[]) => void;
  /**
   * Batches initial state updates from persistence to avoid multiple renders on first load.
   */
  hydrateOnBoot: (params: {
    currentIndex: number;
    currentHistory: ChatHistory;
    descriptions: string[];
  }) => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  // Initialize from persistence to avoid extra renders on mount
  ...(function initFromStorage() {
    const parsed = PersistenceUtils.getChatHistories();
    if (parsed.length > 0) {
      let idx = PersistenceUtils.getCurrentChatIndex();
      if (idx < 0 || idx >= parsed.length) idx = 0;
      const history = parsed[idx] ?? buildDefaultChatHistory();
      const descriptions = parsed.map((h, i) => h.description || `Conversation ${i + 1}`);
      return {
        currentChatIndex: idx,
        currentChatHistory: history,
        chatHistoriesDescriptions: descriptions,
      };
    }
    return {
      currentChatIndex: 0,
      currentChatHistory: buildDefaultChatHistory(),
      chatHistoriesDescriptions: ["Conversation 1"],
    };
  })(),
  chatIndexToLoadOrDelete: null,
  quotedText: undefined,
  setQuotedText: (text: string | undefined) => {
    set((state) =>
      produce(state, (draft) => {
        draft.quotedText = text;
      })
    );
  },
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
        // Always ensure the chat history has all expected keys by merging with defaults ONCE here
        if (typeof param === "function") {
          const next = param(draft.currentChatHistory ?? buildDefaultChatHistory());
          draft.currentChatHistory = { ...buildDefaultChatHistory(), ...next };
        } else {
          draft.currentChatHistory = { ...buildDefaultChatHistory(), ...param };
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
    // Return the stored reference directly; setters ensure shape and defaults
    return get().currentChatHistory ?? buildDefaultChatHistory();
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
  hydrateOnBoot: ({ currentIndex, currentHistory, descriptions }) => {
    set((state) =>
      produce(state, (draft) => {
        draft.currentChatIndex = currentIndex;
        draft.currentChatHistory = { ...buildDefaultChatHistory(), ...currentHistory };
        draft.chatHistoriesDescriptions = descriptions;
      })
    );
  },
}));
