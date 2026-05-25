/**
 * FeedbackForm component
 *
 * Provides an inline feedback UI for rating or commenting on assistant
 * responses in the playground. Connects to the telemetry/feedback service
 * via the playground store to submit user feedback events.
 */

import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import RateReviewOutlinedIcon from "@mui/icons-material/RateReviewOutlined";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { sendFeedback } from "../../api/api";
import { addToast } from "../store/slices/toastSlice";
import { AppDispatch, RootState } from "../store";

interface FeedbackFormProps {
  placement?: "floating" | "topbar";
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ placement = "floating" }) => {
  const { t } = useTranslation("playground");
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const currentSessionId = useSelector((state: RootState) => state.sessions?.currentSessionId ?? null);

  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [positive, setPositive] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setFeedback("");
    setPositive(null);
    setHasAttemptedSubmit(false);
  };

  const handleSubmit = async () => {
    setHasAttemptedSubmit(true);
    if (positive === null || !feedback.trim()) return;

    setIsSubmitting(true);
    const uuid = currentSessionId ?? crypto.randomUUID();

    try {
      await sendFeedback(feedback.trim(), positive, uuid, "playground");
      dispatch(addToast({ message: t("feedback.success"), isError: false }));
      handleClose();
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Feedback submission failed", error);
      }
      dispatch(addToast({ message: t("feedback.error"), isError: true }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Button
        variant="contained"
        disableElevation
        onClick={() => setOpen(true)}
        aria-label={placement === "topbar" && isSmallScreen ? t("feedback") : undefined}
        startIcon={<RateReviewOutlinedIcon sx={{ color: "currentColor" }} />}
        sx={{
          ...(placement === "floating"
            ? {
                position: "fixed",
                right: { xs: 12, sm: 16 },
                bottom: { xs: 12, sm: 16 },
                zIndex: 2000,
              }
            : {}),
          minWidth: { xs: 48, sm: 44 },
          minHeight: 44,
          px: placement === "topbar" ? { xs: 0, sm: 1.5 } : { xs: 2, sm: 1.75 },
          bgcolor: placement === "topbar" ? "white" : "primary.dark",
          color: placement === "topbar" ? "primary.main" : "primary.contrastText",
          textTransform: "none",
          fontWeight: "bold",
          borderRadius: "8px",
          fontSize: { xs: "0.75rem", sm: "0.875rem" },
          "& .MuiButton-startIcon": {
            marginLeft: placement === "topbar" ? { xs: 0, sm: -0.5 } : undefined,
            marginRight: placement === "topbar" ? { xs: 0, sm: 1 } : undefined,
          },
          "&:hover": {
            bgcolor: placement === "topbar" ? "action.hover" : "primary.main",
            color: placement === "topbar" ? "primary.dark" : "primary.contrastText",
          },
        }}
      >
        <Box component="span" sx={{ display: placement === "topbar" ? { xs: "none", sm: "inline" } : "inline" }}>
          {t("feedback")}
        </Box>
      </Button>
      <Dialog
        open={open}
        onClose={handleClose}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmallScreen}
        aria-describedby="feedback-dialog-subtitle"
      >
        <DialogTitle>{t("feedback.system.title")}</DialogTitle>
        <DialogContent>
          <Typography id="feedback-dialog-subtitle" variant="body2" color="text.secondary" gutterBottom>
            {t("feedback.system.subtitle")}
          </Typography>
          <Typography component="p" variant="subtitle2" sx={{ display: "block", mt: 2, mb: 1 }}>
            {t("feedback.reaction.label")}
          </Typography>
          <Box sx={{ mb: 2 }}>
            <ToggleButtonGroup
              exclusive
              value={positive}
              aria-label={t("feedback.reaction.label")}
              onChange={(_, value: boolean | null) => setPositive(value)}
              sx={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                width: "100%",
                gap: 1,
                "& .MuiToggleButton-root": {
                  minHeight: 44,
                  borderRadius: 1,
                  textTransform: "none",
                  justifyContent: "center",
                },
              }}
            >
              <ToggleButton value={true} aria-label={t("good.response")}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {positive === true ? <ThumbUpAltIcon /> : <ThumbUpAltOutlinedIcon />}
                  <Typography variant="body2">{t("good.response")}</Typography>
                </Stack>
              </ToggleButton>
              <ToggleButton value={false} aria-label={t("bad.response")}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {positive === false ? <ThumbDownAltIcon /> : <ThumbDownAltOutlinedIcon />}
                  <Typography variant="body2">{t("bad.response")}</Typography>
                </Stack>
              </ToggleButton>
            </ToggleButtonGroup>
            {hasAttemptedSubmit && positive === null && (
              <Typography variant="caption" color="error" sx={{ mt: 0.75, display: "block" }}>
                {t("feedback.reaction.required")}
              </Typography>
            )}
          </Box>
          <TextField
            label={t("feedback.message.label")}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            multiline
            rows={4}
            fullWidth
            required
            error={hasAttemptedSubmit && !feedback.trim()}
            helperText={hasAttemptedSubmit && !feedback.trim() ? t("feedback.message.required") : " "}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t("cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={positive === null || !feedback.trim() || isSubmitting}
            aria-busy={isSubmitting}
          >
            {t("submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FeedbackForm;