import { useTranslation } from 'react-i18next';
import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  onClear: () => void;
};

export const ClearConversationConfirmation: React.FC<Props> = ({
  open,
  onClose,
  onClear,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("clear.conversation.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("clear.conversation.content")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={onClear} variant="contained" size="small" color='error'>{t("clear")}</Button>
      </DialogActions>
    </Dialog>
  );
};