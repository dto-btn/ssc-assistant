import { RootState } from "..";

export const selectSessionFilesById = (sessionId: string) => (state: RootState) =>
  state.sessionFiles.bySessionId[sessionId] ?? [];
