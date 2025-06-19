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
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <SettingsIcon />
              {t("settings")}
            </div>
            <IconButton onClick={onClose} size="small">
              <CloseIcon />
            </IconButton>
          </div>
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
