import { RootState } from "..";

/**
 * Curry selector that returns the attachments associated with a given session.
 */
export const selectSessionFilesById = (sessionId: string) => (state: RootState) =>
  state.sessionFiles.bySessionId[sessionId] ?? [];
