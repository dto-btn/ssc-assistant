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
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import { sendFeedback } from "../../api/api";
import { addToast } from "../store/slices/toastSlice";
import { AppDispatch, RootState } from "../store";

const FeedbackForm: React.FC = () => {
  const { t } = useTranslation("playground");
  const dispatch = useDispatch<AppDispatch>();
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const currentSessionId = useSelector((state: RootState) => state.sessions.currentSessionId);

  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [positive, setPositive] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setOpen(false);
    setFeedback("");
    setPositive(null);
  };

  const handleSubmit = async () => {
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
        sx={{
          position: "fixed",
          right: isSmallScreen ? 12 : 16,
          bottom: isSmallScreen ? 12 : 16,
          zIndex: 2000,
          minWidth: isSmallScreen ? 48 : 44,
          minHeight: 44,
          px: isSmallScreen ? 2 : 1.75,
          bgcolor: "primary.dark",
          color: "primary.contrastText",
          "&:hover": {
            bgcolor: "primary.main",
          },
        }}
      >
        {t("feedback")}
      </Button>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm" fullScreen={isSmallScreen}>
        <DialogTitle>{t("feedback.system.title")}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {t("feedback.system.subtitle")}
          </Typography>
          <Typography component="label" variant="subtitle2" sx={{ display: "block", mt: 2, mb: 1 }}>
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
            {positive === null && (
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
            error={!feedback.trim()}
            helperText={!feedback.trim() ? t("feedback.message.required") : " "}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>{t("cancel")}</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={positive === null || !feedback.trim() || isSubmitting}
          >
            {t("submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FeedbackForm;