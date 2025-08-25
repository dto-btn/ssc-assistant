import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  IconButton,
} from "@mui/material";
import SettingsIcon from "@mui/icons-material/Settings";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useChatService } from "../hooks/useChatService";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

interface DeleteAllConversationsConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteAllConversationsConfirmation: React.FC<
  DeleteAllConversationsConfirmationProps
> = ({ open, onClose, onConfirm }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("settings.delete.all.conversations.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("settings.delete.all.conversations.confirmation")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={onConfirm} variant="contained" color="error">
          {t("delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const chatService = useChatService();

  const handleDeleteAllConversations = () => {
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDeleteAll = () => {
    chatService.deleteAllChatHistory();
    setShowDeleteConfirmation(false);
    onClose();
  };

  const handleCloseDeleteConfirmation = () => {
    setShowDeleteConfirmation(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-description={t("settings")}>
        <DialogTitle
          sx={{
            display: "inline-flex",
            alignItems: "center",
            gap: 1,
            // Ensure minimal extra padding so vertical alignment is tight
            py: 1,
          }}
        >
          <SettingsIcon fontSize="small" />
          {t("settings")}
          <IconButton onClick={onClose} sx={(theme) => ({
            marginLeft: "auto",
            color: theme.palette.grey[500],
          })} aria-label={t("close")}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <List>
            <ListItem disablePadding>
              <ListItemButton
                onClick={handleDeleteAllConversations}
                sx={{
                  borderRadius: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemIcon>
                  <DeleteIcon color="error" />
                </ListItemIcon>
                <ListItemText
                  primary={t("settings.delete.all.conversations")}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </DialogContent>
      </Dialog>

      <DeleteAllConversationsConfirmation
        open={showDeleteConfirmation}
        onClose={handleCloseDeleteConfirmation}
        onConfirm={handleConfirmDeleteAll}
      />
    </>
  );
};
