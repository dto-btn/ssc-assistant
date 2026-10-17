/**
 * Session slice
 *
 * Manages saved playground sessions (collections of messages and settings).
 * Exposes actions to create, rename, delete, and switch sessions.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { addMessage, hydrateSessionMessages } from "./chatSlice";

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  staticTools?: string[];
  isNewChat: boolean;
}

interface SessionsState {
  sessions: Session[];
  currentSessionId: string | null;
}

const initialState: SessionsState = {
  sessions: [],
  currentSessionId: null,
};

const sessionSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    addSession: (state, action: PayloadAction<Session>) => {
      state.sessions.push({ ...action.payload, updatedAt: action.payload.updatedAt ?? action.payload.createdAt });
      state.currentSessionId = action.payload.id;
    },
    updateSessionActivity: (
      state,
      action: PayloadAction<{ id: string; updatedAt: number }>
    ) => {
      const session = state.sessions.find((session) => session.id === action.payload.id);
      if (session && Number.isFinite(action.payload.updatedAt)) {
        session.updatedAt = Math.max(session.updatedAt ?? session.createdAt, action.payload.updatedAt);
      }
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((session) => session.id !== action.payload);
      if (state.currentSessionId === action.payload) {
        state.currentSessionId = state.sessions.length
          ? state.sessions[0].id
          : null;
      }
    },
    clearAllSessions: (state) => {
      state.sessions = [];
      state.currentSessionId = null;
    },
    setCurrentSession: (state, action: PayloadAction<string>) => {
      state.currentSessionId = action.payload;
    },
    renameSession: (
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) => {
      const session = state.sessions.find((session) => session.id === action.payload.id);
      if (session) session.name = action.payload.name;
    },
    setSessionStaticTools: (
      state,
      action: PayloadAction<{ id: string; tools: string[] }>
    ) => {
      const session = state.sessions.find((session) => session.id === action.payload.id);
      if (session) session.staticTools = action.payload.tools;
    },
    setIsSessionNew: (
      state,
      action: PayloadAction<{ id: string, isNew: boolean}>
    ) => {
      const session = state.sessions.find((session) => session.id === action.payload.id);
      if (session) session.isNewChat = action.payload.isNew;
    }
  },
  extraReducers: (builder) => {
    builder.addCase(addMessage, (state, action) => {
      const session = state.sessions.find((session) => session.id === action.payload.sessionId);
      if (session) {
        session.updatedAt = Math.max(session.updatedAt ?? session.createdAt, Date.now());
      }
    });
    builder.addCase(hydrateSessionMessages, (state, action) => {
      const session = state.sessions.find((session) => session.id === action.payload.sessionId);
      if (session) {
        action.payload.messages.forEach((message) => {
          if (Number.isFinite(message.timestamp)) {
            session.updatedAt = Math.max(session.updatedAt ?? session.createdAt, message.timestamp);
          }
        });
      }
    });
  },
});

export const {
  addSession,
  updateSessionActivity,
  removeSession,
  clearAllSessions,
  setCurrentSession,
  renameSession,
  setSessionStaticTools,
  setIsSessionNew
} = sessionSlice.actions;

export default sessionSlice.reducer;