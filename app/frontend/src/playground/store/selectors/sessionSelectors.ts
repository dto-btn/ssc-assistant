/**
 * Selectors for session-related derived data in the playground store.
 */
import { createSelector } from "reselect";
import type { RootState } from "../index";
import type { Session } from "../slices/sessionSlice";
import type { Message } from "../slices/chatSlice";

/** Base selector to read the sessions array from state. */
const selectSessions = (state: RootState) => state.sessions.sessions;
const selectMessages = (state: RootState) => state.chat.messages;

export const selectSessionLastActivityById = createSelector(
  [selectSessions, selectMessages],
  (sessions: Session[], messages: Message[]) => {
    const lastActivityById: Record<string, number> = {};

    sessions.forEach((session) => {
      lastActivityById[session.id] = session.createdAt;
    });

    messages.forEach((message) => {
      lastActivityById[message.sessionId] = Math.max(
        lastActivityById[message.sessionId] ?? 0,
        message.timestamp,
      );
    });

    return lastActivityById;
  }
);

/**
 * Returns sessions sorted by last message activity (newest first).
 *
 * Uses memoization so consumers only re-render when the input sessions
 * array identity or its items change.
 */
export const selectSessionsNewestFirst = createSelector(
  [selectSessions, selectSessionLastActivityById],
  (sessions: Session[], lastActivityById) => [...sessions].sort((a, b) => {
    const activityDiff = (lastActivityById[b.id] ?? b.createdAt) - (lastActivityById[a.id] ?? a.createdAt);
    return activityDiff || b.createdAt - a.createdAt;
  })
);
