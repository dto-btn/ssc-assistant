import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onDeleteAllChats: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  onDeleteAllChats,
}) => {
  const { t } = useTranslation("playground");
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const handleDeleteClick = () => {
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    onDeleteAllChats();
    setIsConfirmDeleteOpen(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmDeleteOpen(false);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>{t("profile.settings")}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              {t("settings.dangerZone.title", { defaultValue: "Danger Zone" })}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.dangerZone.description", {
                defaultValue:
                  "Actions in this section are permanent and cannot be undone.",
              })}
            </Typography>
            <Box
              sx={{
                p: 2,
                border: "1px solid",
                borderColor: "error.light",
                borderRadius: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Box>
                <Typography variant="body1" fontWeight="medium">
                  {t("settings.deleteChats.title", {
                    defaultValue: "Delete all chats",
                  })}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("settings.deleteChats.description", {
                    defaultValue: "Permanently delete all your chat history.",
                  })}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteSweepIcon />}
                onClick={handleDeleteClick}
              >
                {t("settings.deleteChats.button", {
                  defaultValue: "Delete All",
                })}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit">
            {t("close", { defaultValue: "Close" })}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isConfirmDeleteOpen}
        onClose={handleCancelDelete}
        maxWidth="xs"
      >
        <DialogTitle>
          {t("settings.deleteChats.confirm.title", {
            defaultValue: "Confirm deletion?",
          })}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {t("settings.deleteChats.confirm.message", {
              defaultValue:
                "Are you sure you want to delete ALL chats? This action is permanent.",
            })}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelDelete} color="inherit">
            {t("cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            autoFocus
          >
            {t("delete", { defaultValue: "Delete" })}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SettingsModal;
