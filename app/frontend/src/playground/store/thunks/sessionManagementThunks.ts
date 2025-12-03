/**
 * Session management thunks
 *
 * Helper thunks that coordinate remote session deletion and the associated
 * local clean-up across Redux slices.
 */

import i18n from "../../../i18n";
import { deleteRemoteSession } from "../../api/storage";
import { AppThunk } from "..";
import { addToast } from "../slices/toastSlice";
import { clearSessionMessages } from "../slices/chatSlice";
import { removeSession } from "../slices/sessionSlice";
import { removeSessionFiles } from "../slices/sessionFilesSlice";
import { removeSessionOutboxItems } from "../slices/outboxSlice";

/**
 * Helper that removes every local artifact tied to a session id.
 */
const cleanupSessionLocally = (sessionId: string): AppThunk<void> => (dispatch) => {
  dispatch(clearSessionMessages(sessionId));
  dispatch(removeSessionFiles(sessionId));
  dispatch(removeSessionOutboxItems(sessionId));
  dispatch(removeSession(sessionId));
};

/**
 * Apply a remote delete notification by removing the local copy and showing a toast.
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

/**
 * Call the backend delete endpoint and eagerly clean up the client cache on success.
 */
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
