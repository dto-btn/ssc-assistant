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
const selectSessionIdParam = (_state: RootState, sessionId: string) => sessionId;

export const selectMessagesForSession = createSelector(
  [selectMessages, selectSessionIdParam],
  (messages, sessionId) => messages.filter((message) => message.sessionId === sessionId)
);
