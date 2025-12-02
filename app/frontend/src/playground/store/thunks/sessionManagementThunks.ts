/**
 * Session management thunks
 *
 * Helper thunks that coordinate remote session deletion and the associated
 * local clean-up across Redux slices.
 */

import i18n from "../../../i18n";
import { deleteRemoteSession, renameRemoteSession } from "../../api/storage";
import { AppThunk } from "..";
import { addToast } from "../slices/toastSlice";
import { clearSessionMessages } from "../slices/chatSlice";
import { removeSession } from "../slices/sessionSlice";
import { removeSessionFiles } from "../slices/sessionFilesSlice";
import { removeSessionOutboxItems } from "../slices/outboxSlice";

/**
 * Cleans up all local Redux state associated with a session.
 *
 * Dispatches actions to remove session messages, files, outbox items, and the session itself
 * from their respective Redux slices. Intended to be used whenever a session is deleted,
 * either remotely (e.g., in another window) or locally, to ensure all related state is cleared.
 */

const cleanupSessionLocally = (sessionId: string): AppThunk<void> => (dispatch) => {
  dispatch(clearSessionMessages(sessionId));
  dispatch(removeSessionFiles(sessionId));
  dispatch(removeSessionOutboxItems(sessionId));
  dispatch(removeSession(sessionId));
};

/**
 * Applies a remote session deletion notification by cleaning up all local state
 * associated with the given session. Optionally shows a toast notification unless
 * the `silent` option is set to true.
 *
 * Use this when you receive a remote delete event (e.g., from another window or device)
 * and want to remove the session locally without making a remote API call.
 * For user-initiated deletions that should also delete the session remotely,
 * use `deleteSession` instead.
 *
 * @param sessionId - The ID of the session to clean up locally.
 * @param options - Optional settings.
 * @param options.silent - If true, suppresses the toast notification.
 */

/**
 * Deletes a session by calling the backend delete endpoint and eagerly cleans up the client cache.
 * This function performs both remote deletion and local Redux state cleanup.
 * Use this when the user initiates a session deletion.
 * 
 * Differs from `applyRemoteSessionDeletion`, which only performs local cleanup (e.g., when a session
 * is deleted in another window or remotely).
 */
export const applyRemoteSessionDeletion = (
  sessionId: string,
  options?: { silent?: boolean },
): AppThunk<void> => (dispatch) => {
  if (!sessionId) {
    return;
  }

  dispatch(cleanupSessionLocally(sessionId));

  if (!options?.silent) {
    dispatch(
      addToast({
        message: i18n.t("playground:delete.remote", {
          defaultValue: "Conversation deleted in another window.",
        }),
        isError: false,
      }),
    );
  }
};

export const deleteSession = (sessionId: string): AppThunk<Promise<void>> => async (dispatch, getState) => {
  if (!sessionId) {
    return;
  }

  const { accessToken } = getState().auth;
  if (!accessToken?.trim()) {
    dispatch(
      addToast({
        message: i18n.t("playground:auth.tokenExpired", {
          defaultValue: "Authentication required. Please refresh the page.",
        }),
        isError: true,
      })
    );
    return;
  }

  try {
    await deleteRemoteSession({ sessionId, accessToken });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : i18n.t("playground:errors.deleteFailed", {
            defaultValue: "Could not delete the chat. Please try again.",
          });

    dispatch(
      addToast({
        message,
        isError: true,
      })
    );
    return;
  }

  dispatch(cleanupSessionLocally(sessionId));
  dispatch(
    addToast({
      message: i18n.t("playground:delete.success", {
        defaultValue: "Conversation deleted",
      }),
      isError: false,
    })
  );
};

export const persistSessionRename = (sessionId: string, newName: string): AppThunk<Promise<void>> => async (
  dispatch,
  getState,
) => {
  const trimmedName = newName?.trim();
  if (!sessionId || !trimmedName) {
    return;
  }

  const { accessToken } = getState().auth;
  if (!accessToken?.trim()) {
    dispatch(
      addToast({
        message: i18n.t("playground:auth.tokenExpired", {
          defaultValue: "Authentication required. Please refresh the page.",
        }),
        isError: true,
      })
    );
    return;
  }

  try {
    await renameRemoteSession({ sessionId, name: trimmedName, accessToken });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : i18n.t("playground:errors.renameFailed", {
            defaultValue: "Could not rename the chat. Please try again.",
          });

    dispatch(
      addToast({
        message,
        isError: true,
      })
    );
  }
};
