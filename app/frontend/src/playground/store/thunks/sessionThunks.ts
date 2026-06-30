/**
 * Session thunks
 *
 * Shared thunks for session lifecycle actions that need to be reused
 * across multiple components (e.g., sidebar new-chat button, on-open hook).
 */

import { v4 as uuidv4 } from "uuid";
import type { AppThunk } from "..";
import { addSession, setCurrentSession } from "../slices/sessionSlice";

/**
 * Ensures a new, empty chat session is active.
 *
 * If there is already an existing draft session (`isNewChat === true`), that
 * session is made current instead of creating a duplicate. Otherwise a brand-
 * new session is appended and set as the active one.
 */
export const startNewSession = (): AppThunk<void> => (dispatch, getState) => {
  const { sessions, currentSessionId } = getState().sessions;

  // If the current session is already a fresh draft, nothing to do.
  const currentSession = sessions.find((s) => s.id === currentSessionId);
  if (currentSession?.isNewChat) {
    return;
  }

  // Reuse any existing draft rather than stacking duplicates.
  const existingDraft = sessions.find((s) => s.isNewChat === true);
  if (existingDraft) {
    dispatch(setCurrentSession(existingDraft.id));
    return;
  }

  dispatch(
    addSession({
      id: uuidv4(),
      name: `Conversation ${sessions.length + 1}`,
      createdAt: Date.now(),
      isNewChat: true,
    })
  );
};
