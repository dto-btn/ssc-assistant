/**
 * Feedback thunks
 *
 * Handles submission of thumbs-up / thumbs-down feedback for assistant
 * responses in the playground. Calls the shared feedback API and dispatches
 * a toast notification to inform the user of the outcome.
 */

import { addToast } from "../slices/toastSlice";
import { AppThunk } from "..";
import { sendFeedback } from "../../../api/api";
import i18n from "../../../i18n";

/**
 * Submit like or dislike feedback for a specific assistant message.
 *
 * @param messageId - The message ID used as the feedback UUID.
 * @param positive  - `true` for a like, `false` for a dislike.
 */
export const submitResponseFeedback =
  (messageId: string, positive: boolean): AppThunk =>
  async (dispatch) => {
    const feedbackMessage = positive
      ? i18n.t("feedback.liked", { ns: "playground" })
      : i18n.t("feedback.disliked", { ns: "playground" });

    try {
      await sendFeedback(feedbackMessage, positive, messageId);
      dispatch(
        addToast({
          message: i18n.t("feedback.success", { ns: "playground" }),
          isError: false,
        }),
      );
    } catch {
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      );
    }
  };
