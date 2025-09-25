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
  // track number of in-flight streams per session (count). >0 means loading.
  isLoadingBySession: Record<string, number>;
}

const initialState: ChatState = {
  messages: [],
  isLoadingBySession: {},
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
    // Create an assistant message placeholder (useful for streaming)
    startAssistantMessage: (state, action: PayloadAction<{ sessionId: string; id: string }>) => {
      state.messages.push({
        id: action.payload.id,
        sessionId: action.payload.sessionId,
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      });
    },
    // Append delta text to an existing message by id
    appendToMessage: (state, action: PayloadAction<{ id: string; delta: string }>) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) {
        msg.content = (msg.content || "") + action.payload.delta;
        msg.timestamp = Date.now();
      }
    },
    // Replace message content (useful for finalizing)
    updateMessageContent: (state, action: PayloadAction<{ id: string; content: string }>) => {
      const msg = state.messages.find((m) => m.id === action.payload.id);
      if (msg) {
        msg.content = action.payload.content;
        msg.timestamp = Date.now();
      }
    },
    // Abort any in-flight streams (middleware will listen for this)
    abortAllStreams: () => {
      // no-op in reducer; middleware handles aborting
    },
    // Abort streams only for a given session (middleware will handle)
    abortSessionStreams: (_state, _action: PayloadAction<string>) => {
      // no-op here; middleware handles aborting
    },
    // Increment the loading count for a session
    incrementSessionLoading: (state, action: PayloadAction<string>) => {
      const sid = action.payload;
      state.isLoadingBySession[sid] = (state.isLoadingBySession[sid] || 0) + 1;
    },
    // Decrement the loading count for a session (and cleanup if zero)
    decrementSessionLoading: (state, action: PayloadAction<string>) => {
      const sid = action.payload;
      const cur = state.isLoadingBySession[sid] || 0;
      if (cur <= 1) {
        delete state.isLoadingBySession[sid];
      } else {
        state.isLoadingBySession[sid] = cur - 1;
      }
    },
    // Reset all session loading state (used for full abort)
    resetAllSessionLoading: (state) => {
      state.isLoadingBySession = {};
    },
    deleteMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((message) => message.id !== action.payload);
    },
    clearSessionMessages: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(
        (message) => message.sessionId !== action.payload
      );
    },
    // removed global setIsLoading; loading is tracked per-session
  },
});

export const {
  addMessage,
  startAssistantMessage,
  appendToMessage,
  updateMessageContent,
  abortAllStreams,
  abortSessionStreams,
  incrementSessionLoading,
  decrementSessionLoading,
  resetAllSessionLoading,
  deleteMessage,
  clearSessionMessages,
} = chatSlice.actions;

export default chatSlice.reducer;