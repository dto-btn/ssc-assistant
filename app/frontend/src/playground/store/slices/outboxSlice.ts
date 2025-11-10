import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";

export type OutboxKind = "user-file" | "chat-archive";

export interface BaseOutboxItem {
  id: string;
  kind: OutboxKind;
  createdAt: number;
}

export interface UserFileOutboxItem extends BaseOutboxItem {
  kind: "user-file";
  originalName: string;
  dataUrl: string; // data URL of file
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface ChatArchiveOutboxItem extends BaseOutboxItem {
  kind: "chat-archive";
  sessionId: string;
  dataUrl: string; // data URL of archive JSON
  label?: string; // optional hint for filename
}

export type OutboxItem = UserFileOutboxItem | ChatArchiveOutboxItem;

interface OutboxState {
  items: OutboxItem[];
}

const initialState: OutboxState = {
  items: [],
};

/**
 * Track uploads that need to be retried when connectivity or auth becomes
 * available.
 */
const outboxSlice = createSlice({
  name: "outbox",
  initialState,
  reducers: {
    addUserFileToOutbox: (
      state,
      action: PayloadAction<{
        originalName: string;
        dataUrl: string;
        sessionId?: string;
        metadata?: Record<string, string>;
      }>
    ) => {
      state.items.push({
        id: uuidv4(),
        kind: "user-file",
        createdAt: Date.now(),
        originalName: action.payload.originalName,
        dataUrl: action.payload.dataUrl,
        sessionId: action.payload.sessionId,
        metadata: action.payload.metadata,
      });
    },
    addChatArchiveToOutbox: (state, action: PayloadAction<{ sessionId: string; dataUrl: string; label?: string }>) => {
      const existingIndex = state.items.findIndex(
        (item) => item.kind === "chat-archive" && item.sessionId === action.payload.sessionId,
      );

      const updatedItem: ChatArchiveOutboxItem = {
        id: existingIndex >= 0 ? state.items[existingIndex].id : uuidv4(),
        kind: "chat-archive",
        createdAt: Date.now(),
        sessionId: action.payload.sessionId,
        dataUrl: action.payload.dataUrl,
        label: action.payload.label,
      };

      if (existingIndex >= 0) {
        state.items[existingIndex] = updatedItem;
      } else {
        state.items.push(updatedItem);
      }
    },
    removeOutboxItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
    removeSessionOutboxItems: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => {
        if (item.kind === "chat-archive") {
          return item.sessionId !== action.payload;
        }
        if (item.kind === "user-file") {
          return item.sessionId !== action.payload;
        }
        return true;
      });
    },
  },
});

export const { addUserFileToOutbox, addChatArchiveToOutbox, removeOutboxItem, removeSessionOutboxItems } = outboxSlice.actions;
export default outboxSlice.reducer;
