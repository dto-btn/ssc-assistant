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
  onDelete: () => void;
};
export const DeleteConversationConfirmation: React.FC<Props> = ({
  open,
  onClose,
  onDelete,
}) => {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("delete.conversation.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("delete.conversation.content")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={onDelete}>{t("delete")}</Button>
      </DialogActions>
    </Dialog>
  );
};
