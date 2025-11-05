import { createSelector } from "reselect";
import { RootState } from "..";
import { FileAttachment } from "../../types";

const emptyFileList: FileAttachment[] = [];

/**
 * Curry selector that returns the attachments associated with a given session.
 */
export const selectSessionFilesById = (sessionId: string) => (state: RootState) =>
  state.sessionFiles.bySessionId[sessionId] ?? emptyFileList;

/**
 * Selector that returns the files for the currently active session id.
 */
export const selectCurrentSessionFiles = createSelector(
  [
    (state: RootState) => state.sessionFiles.bySessionId,
    (state: RootState) => state.sessions.currentSessionId,
  ],
  (filesBySession, currentSessionId) =>
    currentSessionId ? filesBySession[currentSessionId] ?? emptyFileList : emptyFileList,
);
