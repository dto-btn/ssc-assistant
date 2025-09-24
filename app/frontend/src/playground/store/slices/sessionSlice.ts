/**
 * Session slice
 *
 * Manages saved playground sessions (collections of messages and settings).
 * Exposes actions to create, rename, delete, and switch sessions.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  staticTools?: string[];
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
      state.sessions.push(action.payload);
      state.currentSessionId = action.payload.id;
    },
    removeSession: (state, action: PayloadAction<string>) => {
      state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      if (state.currentSessionId === action.payload) {
        state.currentSessionId = state.sessions.length
          ? state.sessions[0].id
          : null;
      }
    },
    setCurrentSession: (state, action: PayloadAction<string>) => {
      state.currentSessionId = action.payload;
    },
    renameSession: (
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) session.name = action.payload.name;
    },
    setSessionStaticTools: (
      state,
      action: PayloadAction<{ id: string; tools: string[] }>
    ) => {
      const session = state.sessions.find((s) => s.id === action.payload.id);
      if (session) session.staticTools = action.payload.tools;
    }
  },
});

export const {
  addSession,
  removeSession,
  setCurrentSession,
  renameSession,
  setSessionStaticTools,
} = sessionSlice.actions;

export default sessionSlice.reducer;