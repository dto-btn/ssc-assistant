import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { FileAttachment } from "../../types";

interface SessionFilesState {
  bySessionId: Record<string, FileAttachment[]>;
}

const initialState: SessionFilesState = {
  bySessionId: {},
};

const sessionFilesSlice = createSlice({
  name: "sessionFiles",
  initialState,
  reducers: {
    setSessionFiles: (
      state,
      action: PayloadAction<{ sessionId: string; files: FileAttachment[] }>,
    ) => {
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
        current[existingIndex] = file;
      } else {
        current.push(file);
      }
      state.bySessionId[sessionId] = current;
    },
  },
});

export const { setSessionFiles, upsertSessionFile } = sessionFilesSlice.actions;
export default sessionFilesSlice.reducer;
