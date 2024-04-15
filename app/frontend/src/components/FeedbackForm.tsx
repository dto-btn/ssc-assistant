import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Typography } from '@mui/material';

interface FeedbackFormProps {
  isFeedbackVisible: boolean;
  setIsFeedbackVisible: (isVisible: boolean) => void;
  handleFeedbackSubmit: (feedback: string, isGoodResponse: boolean) => void;
  isGoodResponse: boolean;
  setIsThankYouVisible: (isThankYouVisible: boolean) => void;
  t: (key: string) => string;
}

const FeedbackForm: React.FC<FeedbackFormProps> = ({ isFeedbackVisible, setIsFeedbackVisible, handleFeedbackSubmit, isGoodResponse, setIsThankYouVisible, t }) => {
  const [feedback, setFeedback] = useState('');

  const handleFeedback = (event: React.FormEvent) => {
    event.preventDefault();
    handleFeedbackSubmit(feedback, isGoodResponse);
    setIsFeedbackVisible(false);
    setFeedback('');
  };

  return (
    <Dialog open={isFeedbackVisible} onClose={() => setIsFeedbackVisible(false)} fullWidth maxWidth={"sm"}>
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
        <Button onClick={() => setIsFeedbackVisible(false)}>{t("cancel")}</Button>
        <Button
          style={{ backgroundColor: "#4b3e99", color: "white"}}
          type="submit"
          onClick={(event) => {
            handleFeedback(event);
            setIsThankYouVisible(true);
          }}
        >
          {t("submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FeedbackForm;
