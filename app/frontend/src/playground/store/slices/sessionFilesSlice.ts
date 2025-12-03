import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { FileAttachment } from "../../types";
import { removeSession } from "./sessionSlice";

interface SessionFilesState {
  /**
   * Quick lookup table keyed by session id so UI components can show attachments without refetching.
   */
  bySessionId: Record<string, FileAttachment[]>;
}

const initialState: SessionFilesState = {
  bySessionId: {},
};

/**
 * Cache attachment metadata per session so components can quickly look up
 * file details without refetching from the API.
 */
const sessionFilesSlice = createSlice({
  name: "sessionFiles",
  initialState,
  reducers: {
    setSessionFiles: (
      state,
      action: PayloadAction<{ sessionId: string; files: FileAttachment[] }>,
    ) => {
      // Replace the session's cache after a full refresh from the API.
      state.bySessionId[action.payload.sessionId] = action.payload.files;
    },
    upsertSessionFile: (
      state,
      action: PayloadAction<{ sessionId: string; file: FileAttachment }>,
    ) => {
      const { sessionId, file } = action.payload;
      const current = state.bySessionId[sessionId] ?? [];
      const existingIndex = current.findIndex((item) => item.blobName === file.blobName);
      if (existingIndex >= 0) {
        // Overwrite the stale record so previews reflect the latest metadata.
        current[existingIndex] = file;
      } else {
        current.push(file);
      }
      state.bySessionId[sessionId] = current;
    },
    removeSessionFiles: (state, action: PayloadAction<string>) => {
      // Drop the session cache entirely when the session disappears locally.
      delete state.bySessionId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder.addCase(removeSession, (state, action) => {
      delete state.bySessionId[action.payload];
    });
  },
});

export const { setSessionFiles, upsertSessionFile, removeSessionFiles } = sessionFilesSlice.actions;
export default sessionFilesSlice.reducer;
