/**
 * Selectors for session-related derived data in the playground store.
 */
import { createSelector } from "reselect";
import type { RootState } from "../index";
import type { Session } from "../slices/sessionSlice";

/** Base selector to read the sessions array from state. */
const selectSessions = (state: RootState) => state.sessions.sessions;

/**
 * Returns sessions sorted by creation time (newest first).
 *
 * Uses memoization so consumers only re-render when the input sessions
 * array identity or its items change.
 */
export const selectSessionsNewestFirst = createSelector(
  [selectSessions],
  (sessions: Session[]) => [...sessions].sort((a, b) => b.createdAt - a.createdAt)
);
