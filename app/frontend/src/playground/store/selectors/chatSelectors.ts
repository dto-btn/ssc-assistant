import { createSelector } from "reselect";
import { RootState } from "../../store";

// Input selectors
const selectMessages = (state: RootState) => state.chat.messages;
const selectCurrentSessionId = (state: RootState) =>
  state.sessions.currentSessionId;

// Memoized selector for filtering messages by sessionId
export const selectMessagesBySessionId = createSelector(
  [selectMessages, selectCurrentSessionId],
  (messages, currentSessionId) => {
    return messages.filter((message) => message.sessionId === currentSessionId);
  }
);