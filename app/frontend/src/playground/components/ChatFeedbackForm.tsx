/**
 * ChatFeedbackForm component
 *
 * Two-step modal for per-message response feedback. Step 1 presents two
 * category cards (issue / suggestion); step 2 collects a free-text note.
 * Tracks messageId and sessionId alongside the feedback type and note.
 * Currently logs to console only — wire `handleSubmit` to the backend when ready.
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
    TextField,
    Typography,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useTranslation } from "react-i18next";

type FeedbackType = "issue" | "suggestion";
type Step = "select" | "detail";

const MAX_ATTACHMENTS = 3;

const visuallyHiddenSx = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
} as const;

interface FeedbackAttachment {
    name: string;
    size: number;
    type: string;
}

type ChatFeedbackPayload =
    | {
          messageId: string;
          sessionId: string;
          type: "issue";
          positive: false;
          description: string;
          stepsToReproduce: string;
          attachments: FeedbackAttachment[];
      }
    | {
          messageId: string;
          sessionId: string;
          type: "suggestion";
          positive: true;
          suggestion: string;
          attachments: FeedbackAttachment[];
      };

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
  const { t } = useTranslation("playground");
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [step, setStep] = useState<Step>("select");
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [issueSteps, setIssueSteps] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [attachmentLimitExceeded, setAttachmentLimitExceeded] = useState(false);
  const [attachmentAnnouncement, setAttachmentAnnouncement] = useState("");
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const issueDescriptionRef = useRef<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);
  const suggestionRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );

  const brandColor = theme.palette.primary.main;

  // Delay state reset until after the close animation completes
  const handleClose = useCallback(() => {
    onClose();
    setTimeout(() => {
      setStep("select");
      setFeedbackType(null);
      setIssueDescription("");
      setIssueSteps("");
      setSuggestion("");
      setAttachments([]);
      setAttachmentLimitExceeded(false);
      setAttachmentAnnouncement("");
      setHasAttemptedSubmit(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }, 300);
  }, [onClose]);

  const handleSelectType = useCallback((type: FeedbackType) => {
    setFeedbackType(type);
    setStep("detail");
  }, []);

  const handleBack = useCallback(() => {
    setStep("select");
    setIssueDescription("");
    setIssueSteps("");
    setSuggestion("");
    setAttachments([]);
    setAttachmentLimitExceeded(false);
    setAttachmentAnnouncement("");
    setHasAttemptedSubmit(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const handleAttachmentsChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(event.target.files ?? []);
      const keptFiles = selectedFiles.slice(0, MAX_ATTACHMENTS);
      const exceeded = selectedFiles.length > MAX_ATTACHMENTS;

      setAttachments(keptFiles);
      setAttachmentLimitExceeded(exceeded);

      const baseMessage =
        keptFiles.length > 0
          ? t("chat.feedback.attachments.selected", {
              count: keptFiles.length,
            })
          : t("chat.feedback.attachments.none");
      const limitMessage = exceeded
        ? ` ${t("chat.feedback.attachments.limit.exceeded", {
            max: MAX_ATTACHMENTS,
          })}`
        : "";

      setAttachmentAnnouncement(`${baseMessage}.${limitMessage}`);
    },
    [t],
  );

  useEffect(() => {
    if (!open || step !== "detail") return;

    const targetInput =
      feedbackType === "issue"
        ? issueDescriptionRef.current
        : suggestionRef.current;
    targetInput?.focus();
  }, [feedbackType, open, step]);

  const isIssueInvalid =
    feedbackType === "issue" &&
    (!issueDescription.trim() || !issueSteps.trim());
  const isSuggestionInvalid =
    feedbackType === "suggestion" && !suggestion.trim();
  const isFormInvalid = isIssueInvalid || isSuggestionInvalid;

  // Handle form submission
  // not yet connect to backend, just log to console for now we need an api route for this.
  // I am taking messageId and sessionId as props to this component, so we can send them along with the feedback to
  // trace the exact session and message the feedback is related to.
  const handleSubmit = useCallback(() => {
    setHasAttemptedSubmit(true);
    if (!feedbackType || isFormInvalid) return;

    const attachmentPayload = attachments.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    const payload: ChatFeedbackPayload =
      feedbackType === "issue"
        ? {
            messageId,
            sessionId,
            type: "issue",
            positive: false,
            description: issueDescription.trim(),
            stepsToReproduce: issueSteps.trim(),
            attachments: attachmentPayload,
          }
        : {
            messageId,
            sessionId,
            type: "suggestion",
            positive: true,
            suggestion: suggestion.trim(),
            attachments: attachmentPayload,
          };

    // TODO: wire to backend when ready
    console.log("Chat feedback submitted", payload);

    handleClose();
  }, [
    attachments,
    feedbackType,
    handleClose,
    isFormInvalid,
    issueDescription,
    issueSteps,
    messageId,
    sessionId,
    suggestion,
  ]);

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
  } as const;

  const iconWrapperSx = (color: string) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: 56,
    height: 56,
    borderRadius: "50%",
    bgcolor: alpha(color, 0.12),
    color,
  });

  const dialogTitle =
    step === "select"
      ? t("chat.feedback.title")
      : feedbackType === "issue"
        ? t("chat.feedback.report.issue")
        : t("chat.feedback.suggestion");

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
                aria-label={t("chat.feedback.report.issue")}
              >
                <Box
                  aria-hidden="true"
                  sx={iconWrapperSx(theme.palette.error.main)}
                >
                  <ReportProblemOutlinedIcon />
                </Box>
                <Typography variant="body2" fontWeight="bold">
                  {t("chat.feedback.report.issue")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t("chat.feedback.report.issue.description")}
                </Typography>
              </ButtonBase>

              <ButtonBase
                focusRipple
                onClick={() => handleSelectType("suggestion")}
                sx={cardSx}
                aria-label={t("chat.feedback.suggestion")}
              >
                <Box
                  aria-hidden="true"
                  sx={iconWrapperSx(theme.palette.success.main)}
                >
                  <LightbulbOutlinedIcon />
                </Box>
                <Typography variant="body2" fontWeight="bold">
                  {t("chat.feedback.suggestion")}
                </Typography>
                <Typography variant="caption" color="text.secondary">
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
                  aria-label={t("chat.feedback.issue.description.label")}
                  inputRef={issueDescriptionRef}
                  placeholder={t("chat.feedback.issue.description.placeholder")}
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  required
                  error={hasAttemptedSubmit && !issueDescription.trim()}
                  helperText={
                    hasAttemptedSubmit && !issueDescription.trim()
                      ? t("chat.feedback.issue.description.required")
                      : " "
                  }
                  sx={{ mt: 2 }}
                />

                <TextField
                  label={t("chat.feedback.issue.steps.label")}
                  aria-label={t("chat.feedback.issue.steps.label")}
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
                aria-label={t("chat.feedback.suggestion.note.label")}
                inputRef={suggestionRef}
                value={suggestion}
                placeholder={
                  "" + t("chat.feedback.suggestion.note.placeholder")
                }
                onChange={(e) => setSuggestion(e.target.value)}
                multiline
                rows={4}
                fullWidth
                required
                error={hasAttemptedSubmit && !suggestion.trim()}
                helperText={
                  hasAttemptedSubmit && !suggestion.trim()
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
              {attachmentLimitExceeded && (
                <Typography
                  variant="caption"
                  color="error"
                  sx={{ mt: 0.75, display: "block" }}
                >
                  {t("chat.feedback.attachments.limit.exceeded", {
                    max: MAX_ATTACHMENTS,
                  })}
                </Typography>
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
                sx={visuallyHiddenSx}
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
            disabled={isFormInvalid}
          >
            {t("submit")}
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ChatFeedbackForm;
