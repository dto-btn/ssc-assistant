/**
 * Chat selectors
 *
 * Selector helpers for deriving values from the playground chat slice, such
 * as visible messages, quoted message lookup, and aggregate counts.
 */

import { createSelector } from "reselect";
import { RootState } from "../../store";

// Input selectors
const selectMessages = (state: RootState) => state.chat.messages;
const selectCurrentSessionId = (state: RootState) =>
  state.sessions.currentSessionId;

const selectSessionIdParam = (_state: RootState, sessionId: string) => sessionId;

export const selectMessagesForSession = createSelector(
  [selectMessages, selectSessionIdParam],
  (messages, sessionId) => messages.filter((message) => message.sessionId === sessionId)
);

// Memoized selector for filtering messages by sessionId
export const selectMessagesBySessionId = createSelector(
  [selectMessages, selectCurrentSessionId],
  (messages, currentSessionId) =>
    currentSessionId
      ? messages.filter((message) => message.sessionId === currentSessionId)
      : []
);