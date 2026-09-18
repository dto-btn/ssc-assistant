/**
 * Feedback thunks
 *
 * Handles submission of thumbs-up / thumbs-down feedback for assistant
 * responses in the playground. Calls the shared feedback API and dispatches
 * a toast notification to inform the user of the outcome.
 */

import { addToast } from "../slices/toastSlice"
import { AppThunk } from ".."
import { sendChatFeedback } from "../../api/feedback"
import type {
  ChatFeedbackFormSubmission,
  ChatFeedbackResponseReaction,
} from "../../types"
import { setMessageFeedback } from "../slices/chatSlice"
import i18n from "../../../i18n"

/**
 * Submit like or dislike feedback for a specific assistant message.
 *
 * @param messageId - The message ID used as the feedback UUID.
 * @param positive  - `true` for a like, `false` for a dislike.
 */
export const submitResponseFeedback =
  (sessionId: string, messageId: string, positive: boolean): AppThunk =>
  async (dispatch, getState) => {
    const accessToken = getState().auth.accessToken
    if (!accessToken) {
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
      return
    }
    const previousFeedback = getState().chat.messages.find(
      (message) => message.id === messageId,
    )?.feedback

    const feedback = positive ? "liked" : "disliked"

    // feedback.liked / feedback.disliked are internal description strings sent
    // to the API, not displayed to the user. User-facing toasts use feedback.success
    // and feedback.error below.
    const feedbackMessage = positive
      ? i18n.t("feedback.liked", { ns: "playground" })
      : i18n.t("feedback.disliked", { ns: "playground" })

    const chatFeedbackReaction: ChatFeedbackResponseReaction = {
      messageId,
      sessionId,
      positive,
      type: "reaction",
      description: feedbackMessage,
    }
    const feedbackReactionPayload = encodeFeedbackPayload(chatFeedbackReaction)

    try {
      dispatch(setMessageFeedback({ messageId, feedback }))
      await sendChatFeedback({
        accessToken,
        feedback: feedbackReactionPayload,
        sessionId,
        messageId,
      })

      dispatch(
        addToast({
          message: i18n.t("feedback.success", { ns: "playground" }),
          isError: false,
        }),
      )
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Feedback submission failed", error)
      }
      dispatch(setMessageFeedback({ messageId, feedback: previousFeedback }))
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
    }
  }

/**
 * Clear feedback for a specific message (e.g. when toggling off a like/dislike).
 */
export const clearResponseFeedback =
  (sessionId: string, messageId: string): AppThunk =>
  async (dispatch, getState) => {
    const accessToken = getState().auth.accessToken

    if (!accessToken) {
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
      return
    }

    const payload: ChatFeedbackResponseReaction = {
      messageId,
      sessionId,
      type: "reaction",
      positive: null,
    }

    try {
      await sendChatFeedback({
        accessToken,
        feedback: encodeFeedbackPayload(payload),
        sessionId,
        messageId,
      })
      dispatch(setMessageFeedback({ messageId, feedback: undefined }))
    } catch (error) {
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
    }
  }

/**
 * Submit detailed chat feedback for a specific message.
 *
 * @param feedbackPayload - The feedback payload containing message ID, session ID, and feedback details.
 */
export const submitChatFeedbackForm =
  (feedbackPayload: ChatFeedbackFormSubmission): AppThunk =>
  async (dispatch, getState) => {
    const accessToken = getState().auth.accessToken
    if (!accessToken) {
      console.error("No access token available for chat feedback submission")
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
      return
    }

    try {
      const payload = encodeFeedbackPayload(feedbackPayload)
      await sendChatFeedback({
        accessToken,
        feedback: payload,
        sessionId: feedbackPayload.sessionId,
        messageId: feedbackPayload.messageId,
      })

      dispatch(
        addToast({
          message: i18n.t("feedback.success", { ns: "playground" }),
          isError: false,
        }),
      )
    } catch (error) {
      console.error("Chat feedback submission failed", error)
      dispatch(
        addToast({
          message: i18n.t("feedback.error", { ns: "playground" }),
          isError: true,
        }),
      )
    }
  }

/**
 *  Shared encoder function for chat feedback payloads.
 * @param feedbackPayload - The feedback payload to be encoded.
 * @returns The encoded feedback payload as a base64 data URL.
 */
const encodeFeedbackPayload = (
  feedbackPayload: ChatFeedbackFormSubmission | ChatFeedbackResponseReaction,
) =>
  "data:application/json;base64," +
  btoa(unescape(encodeURIComponent(JSON.stringify(feedbackPayload))))
