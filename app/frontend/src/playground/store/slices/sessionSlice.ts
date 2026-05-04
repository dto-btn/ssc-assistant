/**
 * Session slice
 *
 * Manages saved playground sessions (collections of messages and settings).
 * Exposes actions to create, rename, delete, and switch sessions.
 */

import { createSlice, PayloadAction, UnknownAction } from "@reduxjs/toolkit";

export interface Session {
  id: string;
  name: string;
  createdAt: number;
  staticTools?: string[];
  isNewChat: boolean;
}

export interface RemoteSessionPagingState {
  isInitialLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  nextOffset: number;
  pageSize: number;
  hasLoadedInitialPage: boolean;
}

interface SessionsState {
  sessions: Session[];
  currentSessionId: string | null;
  remoteSessionPaging: RemoteSessionPagingState;
}

const initialRemoteSessionPagingState: RemoteSessionPagingState = {
  isInitialLoading: false,
  isLoadingMore: false,
  hasMore: false,
  nextOffset: 0,
  pageSize: 25,
  hasLoadedInitialPage: false,
};

const initialState: SessionsState = {
  sessions: [],
  currentSessionId: null,
  remoteSessionPaging: initialRemoteSessionPagingState,
};

const normalizeRemoteSessionPagingState = (
  state?: Partial<RemoteSessionPagingState>,
): RemoteSessionPagingState => ({
  ...initialRemoteSessionPagingState,
  ...state,
});

const normalizeSessionsState = (state?: Partial<SessionsState>): SessionsState => ({
  sessions: Array.isArray(state?.sessions) ? state.sessions : [],
  currentSessionId:
    typeof state?.currentSessionId === "string" || state?.currentSessionId === null
      ? state.currentSessionId ?? null
      : null,
  remoteSessionPaging: normalizeRemoteSessionPagingState(state?.remoteSessionPaging),
});

const sessionSlice = createSlice({
  name: "sessions",
  initialState,
  reducers: {
    addSession: (state, action: PayloadAction<Session>) => {
      state.sessions.push(action.payload);
      state.currentSessionId = action.payload.id;
    },
    addRecoveredSessions: (state, action: PayloadAction<Session[]>) => {
      const knownSessionIds = new Set(state.sessions.map((session) => session.id));
      action.payload.forEach((session) => {
        if (knownSessionIds.has(session.id)) {
          return;
        }
        state.sessions.push(session);
        knownSessionIds.add(session.id);
      });
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
      state.remoteSessionPaging = { ...initialRemoteSessionPagingState };
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
    },
    startRemoteSessionBootstrap: (state) => {
      state.remoteSessionPaging.isInitialLoading = true;
      state.remoteSessionPaging.isLoadingMore = false;
    },
    startRemoteSessionLoadMore: (state) => {
      state.remoteSessionPaging.isLoadingMore = true;
    },
    finishRemoteSessionPaging: (
      state,
      action: PayloadAction<{
        hasMore: boolean;
        nextOffset?: number | null;
        pageSize?: number;
        hasLoadedInitialPage?: boolean;
      }>,
    ) => {
      state.remoteSessionPaging.isInitialLoading = false;
      state.remoteSessionPaging.isLoadingMore = false;
      state.remoteSessionPaging.hasMore = action.payload.hasMore;
      if (typeof action.payload.nextOffset === "number") {
        state.remoteSessionPaging.nextOffset = action.payload.nextOffset;
      }
      if (typeof action.payload.pageSize === "number") {
        state.remoteSessionPaging.pageSize = action.payload.pageSize;
      }
      if (action.payload.hasLoadedInitialPage) {
        state.remoteSessionPaging.hasLoadedInitialPage = true;
      }
    },
    failRemoteSessionPaging: (state) => {
      state.remoteSessionPaging.isInitialLoading = false;
      state.remoteSessionPaging.isLoadingMore = false;
    },
  },
});

export const {
  addSession,
  addRecoveredSessions,
  removeSession,
  clearAllSessions,
  setCurrentSession,
  renameSession,
  setSessionStaticTools,
  setIsSessionNew,
  startRemoteSessionBootstrap,
  startRemoteSessionLoadMore,
  finishRemoteSessionPaging,
  failRemoteSessionPaging,
} = sessionSlice.actions;

const sessionReducer = (state: SessionsState | undefined, action: UnknownAction) =>
  sessionSlice.reducer(normalizeSessionsState(state), action);

export default sessionReducer;