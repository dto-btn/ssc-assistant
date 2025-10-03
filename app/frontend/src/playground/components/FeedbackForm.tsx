/**
 * FeedbackForm component
 *
 * Provides an inline feedback UI for rating or commenting on assistant
 * responses in the playground. Connects to the telemetry/feedback service
 * via the playground store to submit user feedback events.
 */

import React, { useState } from "react";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from "@mui/material";
import { useTranslation } from 'react-i18next';

const FeedbackForm: React.FC = () => {
  const { t } = useTranslation('playground');
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <>
      <Button onClick={() => setOpen(true)} sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 2000 }}>
        {t("feedback")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>{t("feedback")}</DialogTitle>
        <DialogContent>
          <TextField
            label={t("your.feedback")}
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            multiline
            rows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t("cancel")}</Button>
          <Button
            variant="contained"
            onClick={() => {
              // TODO: save/send feedback
              setFeedback("");
              setOpen(false);
            }}
            disabled={!feedback.trim()}
          >
            {t("submit")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FeedbackForm;