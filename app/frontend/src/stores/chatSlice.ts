import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { buildDefaultChatHistory, buildDefaultModel } from "./modelBuilders";

// Define the initial state for the chat store
interface ChatStore {
  currentChatIndex: number;
  currentChatHistory: ChatHistory | undefined;
  chatHistoriesDescriptions: string[];
  chatIndexToLoadOrDelete: number | null;
  quotedText: string | undefined;
}

const initialState: ChatStore = {
  currentChatIndex: 0,
  chatIndexToLoadOrDelete: null,
  currentChatHistory: buildDefaultChatHistory(),
  chatHistoriesDescriptions: ["Conversation 1"],
  quotedText: undefined,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setChatIndexToLoadOrDelete(state, action: PayloadAction<number | null>) {
      state.chatIndexToLoadOrDelete = action.payload;
    },
    setCurrentChatHistory(
      state,
      action: PayloadAction<ChatHistory | ((prev: ChatHistory) => ChatHistory)>
    ) {
      if (typeof action.payload === "function") {
        state.currentChatHistory = action.payload(state.currentChatHistory || buildDefaultChatHistory());
      } else {
        state.currentChatHistory = action.payload;
      }
    },
    setDefaultChatHistory(state) {
      state.currentChatHistory = buildDefaultChatHistory();
    },
    setCurrentChatIndex(state, action: PayloadAction<number>) {
      state.currentChatIndex = action.payload;
    },
    setChatHistoriesDescriptions(state, action: PayloadAction<string[]>) {
      state.chatHistoriesDescriptions = action.payload;
    },
  },
});

export const {
  setChatIndexToLoadOrDelete,
  setCurrentChatHistory,
  setDefaultChatHistory,
  setCurrentChatIndex,
  setChatHistoriesDescriptions,
} = chatSlice.actions;

export const getDefaultModel = () => buildDefaultModel();

export const getCurrentChatHistory = (state: ChatStore): ChatHistory => {
  const currentChatHistory = state.currentChatHistory || buildDefaultChatHistory();
  return {
    ...buildDefaultChatHistory(),
    ...currentChatHistory, // This spreads the default chat history to prevent losing keys
  };
};

export default chatSlice.reducer;