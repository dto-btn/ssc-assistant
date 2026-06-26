import React, { useEffect, useState } from "react";
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
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Alert,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { deleteAllSessions } from "../../store/thunks/sessionManagementThunks";
import {
  loadConsent,
  updateConsent,
  loadMemoryGraph,
  deleteAllMemories,
} from "../../store/thunks/memoryThunks";
import MemoryGraph from "../MemoryGraph";

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
  const [isConfirmMemoryDeleteOpen, setIsConfirmMemoryDeleteOpen] = useState(false);
  const [isDeletingMemory, setIsDeletingMemory] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const isDeletingAllChats = useAppSelector((state) => state.ui.isDeletingAllChats);
  const consentOptIn = useAppSelector((state) => state.memory.consentOptIn);
  const consentLoaded = useAppSelector((state) => state.memory.consentLoaded);
  const isLoadingConsent = useAppSelector((state) => state.memory.isLoadingConsent);
  const memoryError = useAppSelector((state) => state.memory.error);

  // Load consent state when modal opens
  useEffect(() => {
    if (open && !consentLoaded) {
      dispatch(loadConsent());
    }
  }, [open, consentLoaded, dispatch]);

  // Load memory graph when Memory tab is activated
  useEffect(() => {
    if (open && tabValue === 1 && consentOptIn) {
      dispatch(loadMemoryGraph());
    }
  }, [open, tabValue, consentOptIn, dispatch]);

  const handleConsentToggle = (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    dispatch(updateConsent(checked));
    if (checked) {
      dispatch(loadMemoryGraph());
    }
  };

  const handleDeleteClick = () => { setIsConfirmDeleteOpen(true); };
  const handleConfirmDelete = () => { dispatch(deleteAllSessions()); setIsConfirmDeleteOpen(false); };
  const handleCancelDelete = () => { setIsConfirmDeleteOpen(false); };

  const handleDeleteMemoryClick = () => { setIsConfirmMemoryDeleteOpen(true); };
  const handleConfirmMemoryDelete = async () => {
    setIsDeletingMemory(true);
    try {
      await dispatch(deleteAllMemories());
    } finally {
      setIsDeletingMemory(false);
      setIsConfirmMemoryDeleteOpen(false);
    }
  };
  const handleCancelMemoryDelete = () => { setIsConfirmMemoryDeleteOpen(false); };

  return (
    <>
      <Dialog
        open={open && !isConfirmDeleteOpen && !isConfirmMemoryDeleteOpen}
        onClose={isDeletingAllChats ? undefined : onClose}
        fullWidth
        maxWidth="sm"
        aria-busy={isDeletingAllChats}
        aria-labelledby="settings-dialog-title"
      >
        <DialogTitle id="settings-dialog-title">{t("profile.settings")}</DialogTitle>
        {isDeletingAllChats && (
          <Box sx={{ width: "100%" }}>
            <LinearProgress color="error" />
            <Box
              component="span"
              sx={{ border: 0, clip: "rect(0 0 0 0)", height: "1px", margin: -1, overflow: "hidden", padding: 0, position: "absolute", whiteSpace: "nowrap", width: "1px" }}
              aria-live="assertive"
            >
              {t("settings.deleteChats.deletingIndicator")}
            </Box>
          </Box>
        )}

        {/* Tab bar */}
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}>
          <Tabs value={tabValue} onChange={(_, v: number) => setTabValue(v)} aria-label={t("profile.settings")}>
            <Tab label={t("settings.tab.general")} id="settings-tab-0" aria-controls="settings-tabpanel-0" />
            <Tab label={t("settings.tab.memory")} id="settings-tab-1" aria-controls="settings-tabpanel-1" />
          </Tabs>
        </Box>

        <DialogContent dividers id="settings-dialog-description">

          {/* ── General tab ── */}
          {tabValue === 0 && (
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
                  p: 2, border: "1px solid", borderColor: "error.light", borderRadius: 1,
                  display: "flex", flexDirection: { xs: "column", md: "row" },
                  alignItems: { xs: "stretch", md: "center" }, justifyContent: "space-between",
                  gap: 2, opacity: isDeletingAllChats ? 0.7 : 1,
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
                  variant="outlined" color="error"
                  sx={{ width: { xs: "100%", md: "auto" }, minWidth: { md: "fit-content" } }}
                  startIcon={isDeletingAllChats ? <CircularProgress size={20} color="error" /> : <DeleteSweepIcon />}
                  onClick={handleDeleteClick}
                  disabled={isDeletingAllChats}
                  aria-label={isDeletingAllChats ? t("settings.deleteChats.deletingIndicator") : t("settings.deleteChats.button")}
                >
                  {t("settings.deleteChats.button")}
                </Button>
              </Box>
            </Box>
          )}

          {/* ── Memory tab ── */}
          {tabValue === 1 && (
            <Box>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold" component="h2">
                {t("memory.consent.title")}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t("memory.consent.description")}
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={consentOptIn}
                    onChange={handleConsentToggle}
                    disabled={isLoadingConsent || !consentLoaded}
                    color="primary"
                  />
                }
                label={
                  isLoadingConsent
                    ? <CircularProgress size={16} sx={{ ml: 1 }} />
                    : t("memory.consent.toggle")
                }
              />

              {memoryError && (
                <Alert severity="error" sx={{ mt: 1 }} onClose={() => dispatch({ type: "memory/setMemoryError", payload: null })}>
                  {memoryError}
                </Alert>
              )}

              {consentOptIn && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="subtitle2" gutterBottom fontWeight="bold">
                    {t("memory.graph.title")}
                  </Typography>
                  <MemoryGraph />

                  <Box
                    sx={{
                      mt: 3, p: 2, border: "1px solid", borderColor: "error.light",
                      borderRadius: 1, display: "flex",
                      flexDirection: { xs: "column", md: "row" },
                      alignItems: { xs: "stretch", md: "center" },
                      justifyContent: "space-between", gap: 2,
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body1" fontWeight="medium">
                        {t("memory.deleteAll.title")}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t("memory.deleteAll.description")}
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined" color="error"
                      sx={{ width: { xs: "100%", md: "auto" }, minWidth: { md: "fit-content" } }}
                      startIcon={isDeletingMemory ? <CircularProgress size={20} color="error" /> : <DeleteSweepIcon />}
                      onClick={handleDeleteMemoryClick}
                      disabled={isDeletingMemory}
                    >
                      {t("memory.deleteAll.button")}
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          )}

        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} color="inherit" disabled={isDeletingAllChats}>
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

      {/* Confirm delete all memories */}
      <Dialog
        open={isConfirmMemoryDeleteOpen}
        onClose={isDeletingMemory ? undefined : handleCancelMemoryDelete}
        maxWidth="xs"
        aria-labelledby="confirm-memory-delete-title"
      >
        <DialogTitle id="confirm-memory-delete-title">
          {t("memory.deleteAll.confirm.title")}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {t("memory.deleteAll.confirm.message")}
          </Typography>
          {isDeletingMemory && (
            <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
              <CircularProgress color="error" />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {!isDeletingMemory && (
            <>
              <Button onClick={handleCancelMemoryDelete} color="inherit">{t("cancel")}</Button>
              <Button onClick={handleConfirmMemoryDelete} color="error" variant="contained" autoFocus>
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
