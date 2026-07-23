import { createSelector } from "reselect";
import { RootState } from "../../store";
import type { SessionSyncStatus, SessionSyncEntry } from "../slices/syncSlice";

const selectSyncState = (state: RootState) => state.sync.byId;

export const selectSyncEntryBySession = createSelector([
  selectSyncState,
  (_: RootState, sessionId: string) => sessionId,
], (syncById, sessionId): SessionSyncEntry | undefined => syncById[sessionId]);

export const selectSyncStatusBySession = createSelector([
  selectSyncEntryBySession,
], (entry): SessionSyncStatus => entry?.status ?? "synced");

export const selectUnsyncedSessionIds = createSelector([
  selectSyncState,
], (syncById) => Object.entries(syncById)
  .filter(([, entry]) => entry.status !== "synced")
  .map(([id]) => id)
);
