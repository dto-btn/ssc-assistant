/**
 * ChatFeedbackForm component
 *
 * Two-step modal for per-message response feedback. Step 1 presents two
 * category cards (issue / suggestion); step 2 collects a free-text note.
 * Tracks messageId and sessionId alongside the feedback type and note.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  CircularProgress,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material"
import { visuallyHidden } from "@mui/utils";
import { alpha } from "@mui/material/styles";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";
import { submitChatFeedback } from "../store/thunks/feedbackThunks";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { useAppSelector } from "../store/hooks"
import { uploadFile } from "../api/storage"
import type { FileAttachment } from "../types"
import { addToast } from "../store/slices/toastSlice"

type FeedbackType = "issue" | "suggestion";
type Step = "select" | "detail";

const MAX_ATTACHMENTS = 3;
const MAX_ATTACHMENT_SIZE_BYTES = 4 * 1024 * 1024; // Set the max file size
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
]);

interface BaseFeedbackForm {
  messageId: string
  sessionId: string
  //postive: boolean;
  type: FeedbackType
  description?: string
}

export type ChatFeedbackFormSubmission = BaseFeedbackForm & {
  stepsToReproduce?: string
  attachments?: FileAttachment[]
}

interface ChatFeedbackFormProps {
  open: boolean;
  onClose: () => void;
  messageId: string;
  sessionId: string;
}

const ChatFeedbackForm: React.FC<ChatFeedbackFormProps> = ({
  open,
  onClose,
  messageId,
  sessionId,
}) => {
  const { t } = useTranslation("playground")
  const theme = useTheme()
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"))
  const dispatch = useDispatch<AppDispatch>()
  const accessToken = useAppSelector((state) => state.auth.accessToken!)

  // State for managing the current step, feedback type, and form inputs
  const [step, setStep] = useState<Step>("select")
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null)
  const [description, setDescription] = useState("")
  const [issueSteps, setIssueSteps] = useState("")

  const [attachments, setAttachments] = useState<File[]>([])
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState("")
  const [attachmentError, setAttachmentError] = useState<string>("")
  const [attachmentErrorAnnouncement, setAttachmentErrorAnnouncement] =
    useState<string>("")

  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false) // validation gate for required fields
  const [isSubmitting, setIsSubmitting] = useState(false) // submission state for async feedback submission

  // Refs for focusing inputs on validation errors
  const issueStepsRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const descriptionRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  )
  const suggestionRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  )

  const brandColor = theme.palette.primary.main

  // Reset all state to initial values
  const resetState = () => {
    setStep("select")
    setFeedbackType(null)
    setDescription("")
    setIssueSteps("")
    setAttachments([])

    setAttachmentAnnouncement("")
    setHasAttemptedSubmit(false)
    setAttachmentError("")
    setAttachmentErrorAnnouncement("")
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Action handlers for dialog navigation and form submission
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  const handleSelectType = useCallback((type: FeedbackType) => {
    setFeedbackType(type)
    setStep("detail")
  }, [])

  const handleBack = useCallback(() => {
    setStep("select")
    resetState()
  }, [])

  const handleAttachmentsChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? [])
      const invalidTypeFiles = selectedFiles.filter(
        (file) => !ALLOWED_ATTACHMENT_TYPES.has(file.type),
      )

      const oversizedFiles = selectedFiles.filter(
        (file) => file.size > MAX_ATTACHMENT_SIZE_BYTES,
      )

      const validFiles = selectedFiles.filter(
        (file) =>
          ALLOWED_ATTACHMENT_TYPES.has(file.type) &&
          file.size <= MAX_ATTACHMENT_SIZE_BYTES,
      )

      const keptFiles = validFiles.slice(0, MAX_ATTACHMENTS)
      const tooManyFiles = validFiles.length > MAX_ATTACHMENTS

      setAttachments(keptFiles)

      const errors: string[] = []

      if (invalidTypeFiles.length > 0) {
        errors.push(
          t("chat.feedback.attachments.invalid.type", {
            defaultValue: "Only JPEG, PNG, and GIF images are allowed.",
          }),
        )
      }

      if (oversizedFiles.length > 0) {
        errors.push(
          t("chat.feedback.attachments.invalid.size", {
            max: MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
          }),
        )
      }

      if (tooManyFiles) {
        errors.push(
          t("chat.feedback.attachments.limit.exceeded", {
            max: MAX_ATTACHMENTS,
          }),
        )
      }

      const errorMessage = errors.join(" ")
      setAttachmentError(errorMessage)
      setAttachmentErrorAnnouncement(errorMessage)

      const selectedMessage =
        keptFiles.length > 0
          ? `${t("chat.feedback.attachments.selected", {
              count: keptFiles.length,
            })}: ${keptFiles.map((file) => file.name).join(", ")}`
          : t("chat.feedback.attachments.none")

      setAttachmentAnnouncement(selectedMessage)
    },
    [t],
  )

  useEffect(() => {
    if (!open || step !== "detail") return

    const targetInput =
      feedbackType === "issue" ? descriptionRef.current : suggestionRef.current
    targetInput?.focus()
  }, [feedbackType, open, step])

  /** Uses feedback thunks to handle submission of the payload */
  const handleSubmit = useCallback(async () => {
    setHasAttemptedSubmit(true)
    // Validate required fields based on feedback type
    if (!feedbackType) {
      return
    }

    if (feedbackType === "issue") {
      if (!description.trim()) {
        descriptionRef.current?.focus()
        return
      }

      if (!issueSteps.trim()) {
        issueStepsRef.current?.focus()
        return
      }
    }

    if (feedbackType === "suggestion" && !description.trim()) {
      suggestionRef.current?.focus()
      return
    }
    // proceed with submission if all required fields are valid
    setIsSubmitting(true)
    let uploadedAttachments: FileAttachment[] = []
    if (attachments && attachments.length > 0) {
      try {
        uploadedAttachments = await Promise.all(
          attachments.map((file) =>
            uploadFile({
              file,
              accessToken,
              sessionId,
              category: "feedback",
              metadata: { messageId },
            }),
          ),
        )
      } catch (error) {
        dispatch(
          addToast({
            message: t("chat.feedback.attachments.upload.error"),
            isError: true,
          }),
        )
        setIsSubmitting(false)
        return
      }
    }

    const payload: ChatFeedbackFormSubmission =
      feedbackType === "issue"
        ? {
            messageId,
            sessionId,
            type: "issue",
            // positive: false,
            description: description.trim(),
            stepsToReproduce: issueSteps.trim(),
            attachments: uploadedAttachments,
          }
        : {
            messageId,
            sessionId,
            type: "suggestion",
            // positive: true,
            description: description.trim(),
            attachments: uploadedAttachments,
          }

    await dispatch(submitChatFeedback(payload)) // This is a thunk that will handle the API call and dispatching to the store
    setIsSubmitting(false)
    handleClose()
  }, [
    attachments,
    feedbackType,
    handleClose,
    accessToken,
    description,
    issueSteps,
    messageId,
    sessionId,
    dispatch,
  ])

  /** sx applied to each category card — full WCAG 2.5.5 touch target and keyboard focus ring */
  const cardSx = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    p: 2.5,
    gap: 1,
    borderRadius: 2,
    border: `1px solid ${theme.palette.divider}`,
    width: "100%",
    minHeight: 44,
    transition: "border-color 0.15s, box-shadow 0.15s",
    "&:hover": {
      borderColor: brandColor,
      boxShadow: `0 0 0 2px ${alpha(brandColor, 0.2)}`,
    },
    "&.Mui-focusVisible": {
      outline: `2px solid ${brandColor}`,
      outlineOffset: "2px",
    },
  } as const

  const iconWrapperSx = (color: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: "50%",
    bgcolor: alpha(color, 0.12),
    color,
  })

  const dialogTitle =
    step === "select"
      ? t("chat.feedback.title")
      : feedbackType === "issue"
        ? t("chat.feedback.report.issue")
        : t("chat.feedback.suggestion")

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      fullScreen={isSmallScreen}
      aria-labelledby="chat-feedback-dialog-title"
      aria-describedby={
        step === "select" ? "chat-feedback-dialog-subtitle" : undefined
      }
      slotProps={{ transition: { onExited: resetState } }}
    >
      <DialogTitle
        id="chat-feedback-dialog-title"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        {step === "detail" && (
          <IconButton
            aria-label={t("chat.feedback.back")}
            edge="start"
            onClick={handleBack}
            size="small"
            sx={{ mr: 0.5 }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        {dialogTitle}
      </DialogTitle>

      <DialogContent>
        {step === "select" ? (
          <>
            <Typography
              id="chat-feedback-dialog-subtitle"
              variant="body2"
              color="text.secondary"
              gutterBottom
            >
              {t("chat.feedback.subtitle")}
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 2,
                mt: 2,
              }}
            >
              <ButtonBase
                focusRipple
                onClick={() => handleSelectType("issue")}
                sx={cardSx}
                aria-labelledby="feedback-issue-title"
                aria-describedby="feedback-issue-description"
              >
                <Box
                  aria-hidden="true"
                  sx={iconWrapperSx(theme.palette.error.main)}
                >
                  <ReportProblemOutlinedIcon />
                </Box>
                <Typography
                  id="feedback-issue-title"
                  variant="body2"
                  fontWeight="bold"
                >
                  {t("chat.feedback.report.issue")}
                </Typography>
                <Typography
                  id="feedback-issue-description"
                  variant="caption"
                  color="text.primary"
                >
                  {t("chat.feedback.report.issue.description")}
                </Typography>
              </ButtonBase>

              <ButtonBase
                focusRipple
                onClick={() => handleSelectType("suggestion")}
                sx={cardSx}
                aria-labelledby="feedback-suggestion-title"
                aria-describedby="feedback-suggestion-description"
              >
                <Box
                  aria-hidden="true"
                  sx={iconWrapperSx(theme.palette.success.main)}
                >
                  <LightbulbOutlinedIcon />
                </Box>
                <Typography
                  id="feedback-suggestion-title"
                  variant="body2"
                  fontWeight="bold"
                >
                  {t("chat.feedback.suggestion")}
                </Typography>
                <Typography
                  id="feedback-suggestion-description"
                  variant="caption"
                  color="text.primary"
                >
                  {t("chat.feedback.suggestion.description")}
                </Typography>
              </ButtonBase>
            </Box>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {feedbackType === "issue"
                ? t("chat.feedback.report.issue.detail.subtitle")
                : t("chat.feedback.suggestion.detail.subtitle")}
            </Typography>

            {feedbackType === "issue" ? (
              <>
                <TextField
                  label={t("chat.feedback.issue.description.label")}
                  inputRef={descriptionRef}
                  placeholder={t("chat.feedback.issue.description.placeholder")}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  required
                  error={hasAttemptedSubmit && !description.trim()}
                  helperText={
                    hasAttemptedSubmit && !description.trim()
                      ? t("chat.feedback.issue.description.required")
                      : " "
                  }
                  sx={{ mt: 2 }}
                />

                <TextField
                  label={t("chat.feedback.issue.steps.label")}
                  inputRef={issueStepsRef}
                  placeholder={"" + t("chat.feedback.issue.steps.placeholder")}
                  value={issueSteps}
                  onChange={(e) => setIssueSteps(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  required
                  error={hasAttemptedSubmit && !issueSteps.trim()}
                  helperText={
                    hasAttemptedSubmit && !issueSteps.trim()
                      ? t("chat.feedback.issue.steps.required")
                      : " "
                  }
                />
              </>
            ) : (
              <TextField
                label={t("chat.feedback.suggestion.note.label")}
                inputRef={suggestionRef}
                value={description}
                placeholder={
                  "" + t("chat.feedback.suggestion.note.placeholder")
                }
                onChange={(e) => setDescription(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required
                error={hasAttemptedSubmit && !description.trim()}
                helperText={
                  hasAttemptedSubmit && !description.trim()
                    ? t("chat.feedback.suggestion.note.required")
                    : " "
                }
                sx={{ mt: 2 }}
              />
            )}

            <Box sx={{ mt: 1 }}>
              <Typography
                component="p"
                variant="subtitle2"
                sx={{ display: "block", mb: 1 }}
              >
                {t("chat.feedback.attachments.label")}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Button
                  variant="outlined"
                  component="label"
                  sx={{ textTransform: "none" }}
                >
                  {t("chat.feedback.attachments.choose")}
                  <input
                    ref={fileInputRef}
                    type="file"
                    hidden
                    multiple
                    accept=".jpg,.jpeg,.png,.gif,image/jpeg,image/png,image/gif"
                    onChange={handleAttachmentsChange}
                  />
                </Button>
                <Typography variant="body2" color="text.secondary">
                  {attachments.length > 0
                    ? t("chat.feedback.attachments.selected", {
                        count: attachments.length,
                      })
                    : t("chat.feedback.attachments.none")}
                </Typography>
              </Box>
              {attachmentError && (
                <Typography
                  role="alert"
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.75, display: "block" }}
                >
                  {attachmentError}
                </Typography>
              )}
              {attachmentErrorAnnouncement && (
                <Box role="alert" sx={visuallyHidden}>
                  {attachmentErrorAnnouncement}
                </Box>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 0.75, display: "block" }}
              >
                {t("chat.feedback.attachments.max")}
              </Typography>
              <Box
                component="span"
                aria-live="polite"
                aria-atomic="true"
                sx={visuallyHidden}
              >
                {attachmentAnnouncement}
              </Box>
            </Box>
          </>
        )}
      </DialogContent>

      {step === "detail" && (
        <DialogActions>
          <Button onClick={handleClose}>{t("cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {t("submit")}
            {isSubmitting && (
              <CircularProgress size={20} sx={{ ml: 1, color: "inherit" }} />
            )}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  )
};

export default ChatFeedbackForm;
