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

const outboxSlice = createSlice({
  name: "outbox",
  initialState,
  reducers: {
    addUserFileToOutbox: (state, action: PayloadAction<{ originalName: string; dataUrl: string }>) => {
      state.items.push({
        id: uuidv4(),
        kind: "user-file",
        createdAt: Date.now(),
        originalName: action.payload.originalName,
        dataUrl: action.payload.dataUrl,
      });
    },
    addChatArchiveToOutbox: (state, action: PayloadAction<{ sessionId: string; dataUrl: string; label?: string }>) => {
      state.items.push({
        id: uuidv4(),
        kind: "chat-archive",
        createdAt: Date.now(),
        sessionId: action.payload.sessionId,
        dataUrl: action.payload.dataUrl,
        label: action.payload.label,
      });
    },
    removeOutboxItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(i => i.id !== action.payload);
    },
  },
});

export const { addUserFileToOutbox, addChatArchiveToOutbox, removeOutboxItem } = outboxSlice.actions;
export default outboxSlice.reducer;
