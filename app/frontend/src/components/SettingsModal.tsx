import React, { ChangeEvent, useEffect, useRef, useState } from "react";
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
import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import { PersistenceUtils } from "../util/persistence";

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
        <Button id="cancel-delete-all-chats-button" onClick={onClose}>{t("cancel")}</Button>
        <Button id="confirm-delete-all-chats-button" onClick={onConfirm} variant="contained" color="error">
          {t("delete")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface ImportConversationsConfirmationProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isImporting: boolean;
}

const ImportConversationsConfirmation: React.FC<ImportConversationsConfirmationProps> = ({ open, onClose, onConfirm, isImporting }) => {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("settings.import.confirmation.title")}</DialogTitle>
      <DialogContent>
        <DialogContentText>
          {t("settings.import.confirmation.message")}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button id="cancel-import-chats-button" onClick={onClose}>{t("cancel")}</Button>
        <Button
          id="confirm-import-chats-button"
          onClick={onConfirm}
          variant="contained"
          color="warning"
          disabled={isImporting}
        >
          {t("replace")}
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
  const [showImportConfirmation, setShowImportConfirmation] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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

  const resetFileSelection = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPendingImportFile(null);
  };

  useEffect(() => {
    if (!open) {
      setShowImportConfirmation(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setPendingImportFile(null);
      setIsImporting(false);
    }
  }, [open]);

  const shouldPromptBeforeImport = () => {
    const histories = PersistenceUtils.getChatHistories();
    if (histories.length === 0) {
      return false;
    }

    const hasNonEmptyConversation = histories.some((history) => {
      const chatItems = history?.chatItems;
      return Array.isArray(chatItems) && chatItems.length > 0;
    });

    return hasNonEmptyConversation || histories.length > 1;
  };

  const handleImportClick = () => {
    if (isImporting) {
      return;
    }
    fileInputRef.current?.click();
  };

  const performImport = async (file: File) => {
    setIsImporting(true);
    try {
      await chatService.importChatHistories(file);
    } catch (error) {
      console.error("Failed to import chat histories:", error);
    } finally {
      setShowImportConfirmation(false);
      resetFileSelection();
      setIsImporting(false);
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setPendingImportFile(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (shouldPromptBeforeImport()) {
      setShowImportConfirmation(true);
    } else {
      void performImport(file);
    }
  };

  const handleConfirmImport = () => {
    if (!pendingImportFile) {
      setShowImportConfirmation(false);
      resetFileSelection();
      return;
    }

    void performImport(pendingImportFile);
  };

  const handleCancelImport = () => {
    setShowImportConfirmation(false);
    resetFileSelection();
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
          <IconButton id="close-settings-button" onClick={onClose} sx={(theme) => ({
            marginLeft: "auto",
            color: theme.palette.grey[500],
          })} aria-label={t("close")}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: "none" }}
            onChange={handleFileInputChange}
            aria-hidden="true"
          />
          <List>
            <ListItem disablePadding>
              <ListItemButton
                id="import-all-chats-button"
                onClick={handleImportClick}
                disabled={isImporting}
                sx={{
                  borderRadius: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemIcon>
                  <UploadIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={t("settings.import.all.conversations")}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                id="export-all-chats-button"
                onClick={chatService.exportChatHistories}
                sx={{
                  borderRadius: 1,
                  "&:hover": {
                    backgroundColor: "action.hover",
                  },
                }}
              >
                <ListItemIcon>
                  <DownloadIcon color="primary" />
                </ListItemIcon>
                <ListItemText
                  primary={t("settings.export.all.conversations")}
                />
              </ListItemButton>
            </ListItem>
            <ListItem disablePadding>
              <ListItemButton
                id="delete-all-chats-button"
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
      <ImportConversationsConfirmation
        open={showImportConfirmation}
        onClose={handleCancelImport}
        onConfirm={handleConfirmImport}
        isImporting={isImporting}
      />
    </>
  );
};
