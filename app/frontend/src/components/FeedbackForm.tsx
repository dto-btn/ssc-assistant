import React from 'react';
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogActions, DialogTitle, DialogContent, TextField, Typography } from '@mui/material';

interface FeedbackFormProps {
  feedback: string;
  setFeedback: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  handleClose: () => void;
  handleFeedbackSubmit: (event: React.FormEvent) => void;
  isThankYouVisible: boolean;
  setIsThankYouVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

export const FeedbackForm = ({ feedback, setFeedback, open, handleClose, handleFeedbackSubmit, isThankYouVisible, setIsThankYouVisible }: FeedbackFormProps) => {
  const { t } = useTranslation();

  const handleCloseAndReset = () => {
    handleClose();
    setTimeout(() => {
      setIsThankYouVisible(false);
    }, 200); // delay of 200ms to prevent flash of dialog before closing
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth={"sm"}>
      {isThankYouVisible ? (
        <>
          <DialogTitle>{t("feedback.submitted")}</DialogTitle>
          <DialogActions>
            <Button onClick={handleCloseAndReset}>{t("close")}</Button>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>{t("provide.feedback")}</DialogTitle>
          <Typography variant="subtitle2" align="left" style={{ paddingLeft: "24px" }}>{t("msg.opt")}</Typography>

          <DialogContent>
            <TextField
              multiline
              rows={4}
              fullWidth
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleClose}>{t("cancel")}</Button>
            <Button
              style={{ backgroundColor: "#4b3e99", color: "white"}}
              type="submit"
              onClick={handleFeedbackSubmit}
            >
              {t("submit")}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};