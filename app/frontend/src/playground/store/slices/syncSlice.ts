import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { addSession, removeSession } from "./sessionSlice";

export type SessionSyncStatus = "synced" | "pending" | "syncing" | "error";

export interface SessionSyncEntry {
  status: SessionSyncStatus;
  updatedAt: number;
  error?: string | null;
}

interface SyncState {
  byId: Record<string, SessionSyncEntry>;
}

const initialState: SyncState = {
  byId: {},
};

const ensureEntry = (state: SyncState, sessionId: string): SessionSyncEntry => {
  const existing = state.byId[sessionId];
  if (existing) {
    return existing;
  }
  const entry: SessionSyncEntry = {
    status: "synced",
    updatedAt: Date.now(),
    error: null,
  };
  state.byId[sessionId] = entry;
  return entry;
};

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    markSessionDirty: (state, action: PayloadAction<{ sessionId: string }>) => {
      const entry = ensureEntry(state, action.payload.sessionId);
      entry.status = "pending";
      entry.updatedAt = Date.now();
      entry.error = null;
    },
    markSessionSyncing: (state, action: PayloadAction<{ sessionId: string }>) => {
      const entry = ensureEntry(state, action.payload.sessionId);
      entry.status = "syncing";
      entry.updatedAt = Date.now();
      entry.error = null;
    },
    markSessionSynced: (state, action: PayloadAction<{ sessionId: string }>) => {
      const entry = ensureEntry(state, action.payload.sessionId);
      entry.status = "synced";
      entry.updatedAt = Date.now();
      entry.error = null;
    },
    markSessionError: (state, action: PayloadAction<{ sessionId: string; error?: string }>) => {
      const entry = ensureEntry(state, action.payload.sessionId);
      entry.status = "error";
      entry.updatedAt = Date.now();
      entry.error = action.payload.error ?? null;
    },
    resetSessionSync: (state, action: PayloadAction<{ sessionId: string }>) => {
      delete state.byId[action.payload.sessionId];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(addSession, (state, action) => {
        state.byId[action.payload.id] = {
          status: "synced",
          updatedAt: Date.now(),
          error: null,
        };
      })
      .addCase(removeSession, (state, action) => {
        delete state.byId[action.payload];
      });
  },
});

export const {
  markSessionDirty,
  markSessionSyncing,
  markSessionSynced,
  markSessionError,
  resetSessionSync,
} = syncSlice.actions;

export default syncSlice.reducer;
