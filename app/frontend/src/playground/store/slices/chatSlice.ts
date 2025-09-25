/**
 * Chat slice
 *
 * Redux slice that stores chat messages and related metadata for the
 * playground. Exposes actions for adding messages, updating status, and
 * clearing chat history.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: unknown[];
  citations?: { title: string; url: string }[];
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

const initialState: ChatState = {
  messages: [],
  isLoading: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Omit<Message, "id" | "timestamp">>) => {
      state.messages.push({
        ...action.payload,
        id: uuidv4(),
        timestamp: Date.now(),
      });
    },
    deleteMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((message) => message.id !== action.payload);
    },
    clearSessionMessages: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(
        (message) => message.sessionId !== action.payload
      );
    },
    updateMessageContent: (state, action: PayloadAction<{ messageId: string; content: string }>) => {
      const { messageId, content } = action.payload;
      const message = state.messages.find(msg => msg.id === messageId);
      if (message) {
        message.content = content;
      }
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    }
  },
});

export const { addMessage, deleteMessage, clearSessionMessages, updateMessageContent, setIsLoading } = chatSlice.actions;

export default chatSlice.reducer;