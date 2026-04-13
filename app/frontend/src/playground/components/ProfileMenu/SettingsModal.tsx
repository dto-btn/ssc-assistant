import React, { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  LinearProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { deleteAllSessions } from "../../store/thunks/sessionManagementThunks";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
}) => {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const isDeletingAllChats = useAppSelector((state) => state.ui.isDeletingAllChats);

  const handleDeleteClick = () => {
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = () => {
    dispatch(deleteAllSessions());
    setIsConfirmDeleteOpen(false);
  };

  const handleCancelDelete = () => {
    setIsConfirmDeleteOpen(false);
  };

  return (
    <>
      <Dialog
        open={open && !isConfirmDeleteOpen}
        onClose={isDeletingAllChats ? undefined : onClose}
        fullWidth
        maxWidth="sm"
        aria-busy={isDeletingAllChats}
        aria-labelledby="settings-dialog-title"
        aria-describedby="settings-dialog-description"
      >
        <DialogTitle id="settings-dialog-title">{t("profile.settings")}</DialogTitle>
        {isDeletingAllChats && (
          <Box sx={{ width: "100%" }}>
            <LinearProgress color="error" />
            <Box
              component="span"
              sx={{
                border: 0,
                clip: "rect(0 0 0 0)",
                height: "1px",
                margin: -1,
                overflow: "hidden",
                padding: 0,
                position: "absolute",
                whiteSpace: "nowrap",
                width: "1px",
              }}
              aria-live="assertive"
            >
              {t("settings.deleteChats.deletingIndicator")}
            </Box>
          </Box>
        )}
        <DialogContent dividers id="settings-dialog-description">
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold" component="h2">
              {t("settings.dangerZone.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {t("settings.dangerZone.description")}
            </Typography>
            <Box
              role="group"
              aria-labelledby="delete-chats-section-title"
              sx={{
                p: 2,
                border: "1px solid",
                borderColor: "error.light",
                borderRadius: 1,
                display: "flex",
                flexDirection: { xs: "column", md: "row" },
                alignItems: { xs: "stretch", md: "center" },
                justifyContent: "space-between",
                gap: 2,
                opacity: isDeletingAllChats ? 0.7 : 1,
              }}
            >
              <Box sx={{ flex: 1 }}>
                <Typography id="delete-chats-section-title" variant="body1" fontWeight="medium">
                  {t("settings.deleteChats.title")}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {t("settings.deleteChats.description")}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                color="error"
                sx={{ width: { xs: "100%", md: "auto" }, minWidth: { md: "fit-content" } }}
                startIcon={
                  isDeletingAllChats ? (
                    <CircularProgress size={20} color="error" />
                  ) : (
                    <DeleteSweepIcon />
                  )
                }
                onClick={handleDeleteClick}
                disabled={isDeletingAllChats}
                aria-label={
                  isDeletingAllChats
                    ? t("settings.deleteChats.deletingIndicator")
                    : t("settings.deleteChats.button")
                }
              >
                {t("settings.deleteChats.button")}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onClose}
            color="inherit"
            disabled={isDeletingAllChats}
          >
            {t("close")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isConfirmDeleteOpen || isDeletingAllChats}
        onClose={isDeletingAllChats ? undefined : handleCancelDelete}
        maxWidth="xs"
        aria-labelledby="confirm-delete-title"
        aria-describedby="confirm-delete-description"
      >
        <DialogTitle id="confirm-delete-title">
          {isDeletingAllChats 
            ? t("settings.deleteChats.deletingIndicator")
            : t("settings.deleteChats.confirm.title")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" id="confirm-delete-description">
            {isDeletingAllChats 
              ? t("settings.deleteChats.deletingIndicator")
              : t("settings.deleteChats.confirm.message")}
          </Typography>
          {isDeletingAllChats && (
             <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress color="error" />
             </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isDeletingAllChats && (
            <>
              <Button onClick={handleCancelDelete} color="inherit">
                {t("cancel")}
              </Button>
              <Button
                onClick={handleConfirmDelete}
                color="error"
                variant="contained"
                autoFocus
              >
                {t("delete")}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default SettingsModal;
