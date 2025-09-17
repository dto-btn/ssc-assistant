import React, { useState } from 'react';
import { useTranslation } from "react-i18next";
import { Button, Dialog, DialogActions, DialogTitle, DialogContent, TextField, Typography } from '@mui/material';
import { useAppStore } from '../stores/AppStore';
import { sendFeedback } from "../api/api";
import { useChatStore } from '../stores/ChatStore';

export const FeedbackForm = () => {
  const { getCurrentChatHistory, setCurrentChatHistory } = useChatStore();
  const { close, state } = useAppStore((state) => state.feedbackForm);

  const isOpen = state === "open-positive" || state === "open-negative";

  const { t } = useTranslation();
  const [feedback, setFeedback] = useState("");

  const handleFeedbackSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    close();

    let toast: ToastMessage;
    const isGoodResponse = state === "open-positive";

    try {
      await sendFeedback(feedback, isGoodResponse, getCurrentChatHistory().uuid);
      toast = {
        toastMessage: t("feedback.success"),
        isError: false,
      };
    } catch (error) {
      toast = {
        toastMessage: t("feedback.fail"),
        isError: true,
      };
    }

    setCurrentChatHistory((prevChatHistory) => {
      const updatedChatHistory = {
        ...prevChatHistory,
        chatItems: [...prevChatHistory.chatItems, toast],
      };

      return updatedChatHistory;
    });

    setFeedback("");
  };

  return (
    <Dialog open={isOpen} onClose={() => close()} fullWidth maxWidth={"sm"}>
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
        <Button id="feedback-cancel-button" onClick={() => close()}>{t("cancel")}</Button>
        <Button
          id="feedback-submit-button"
          style={{ backgroundColor: "#4b3e99", color: "white" }}
          type="submit"
          onClick={handleFeedbackSubmit}
        >
          {t("submit")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};