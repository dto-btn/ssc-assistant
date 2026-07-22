import React from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";

import {
  acceptPlaygroundDisclaimer,
  getNextPlaygroundDisclaimer,
  loadPlaygroundDisclaimerState,
  savePlaygroundDisclaimerState,
  type PlaygroundDisclaimerKey,
  type PlaygroundDisclaimerState,
} from "../utils/disclaimerState";

const CONTENT_KEYS: Record<
  PlaygroundDisclaimerKey,
  { title: string; body: string; strong: string }
> = {
  assistant: {
    title: "disclaimer.modal.title.assistant",
    body: "disclaimer.modal.assistant.body",
    strong: "disclaimer.modal.assistant.strong",
  },
  br: {
    title: "disclaimer.modal.title.br",
    body: "disclaimer.modal.br.body",
    strong: "disclaimer.modal.br.strong",
  },
};

const PlaygroundDisclaimerDialog: React.FC = () => {
  const { t, i18n } = useTranslation("playground");
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [state, setState] = React.useState<PlaygroundDisclaimerState>(
    () => loadPlaygroundDisclaimerState(),
  );

  const currentDisclaimer = React.useMemo(
    () => getNextPlaygroundDisclaimer(state, Date.now()),
    [state],
  );

  // Toggle `inert` on the application root while the playground disclaimer is visible
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    const modalRoot = document.getElementById('modal-root');
    if (!root) return;
    if (currentDisclaimer) {
      try {
        (root as any).inert = true;
      } catch (e) {}
      if (modalRoot) modalRoot.removeAttribute('aria-hidden');
    } else {
      try {
        (root as any).inert = false;
      } catch (e) {}
    }
    return () => {
      try {
        (root as any).inert = false;
      } catch (e) {}
    };
  }, [currentDisclaimer]);

  const handleAccept = () => {
    if (!currentDisclaimer) {
      return;
    }

    const now = Date.now();
    setState((previous) => {
      const next = acceptPlaygroundDisclaimer(currentDisclaimer, previous, now);
      savePlaygroundDisclaimerState(next);
      return next;
    });
  };

  const handleLanguageToggle = () => {
    const newLanguage = i18n.language === "en" ? "fr" : "en";
    void i18n.changeLanguage(newLanguage);
  };

  const handleMandatoryDialogClose = () => {
    // The disclaimer must be acknowledged explicitly via the Accept button.
  };

  if (!currentDisclaimer) {
    return null;
  }

  const contentKeys = CONTENT_KEYS[currentDisclaimer];
  const descriptionId = "playground-disclaimer-description";

  const dialog = (
    <Dialog
      open
      fullWidth
      maxWidth="md"
      fullScreen={isSmallScreen}
      disableEscapeKeyDown
      disableScrollLock
      disablePortal
      onClose={handleMandatoryDialogClose}
      aria-labelledby="playground-disclaimer-title"
      aria-describedby={descriptionId}
    >
      <DialogTitle id="playground-disclaimer-title">{t(contentKeys.title)}</DialogTitle>
      <DialogContent>
        <Typography id={descriptionId} component="p" sx={{ mb: 3 }}>
          {t(contentKeys.body)}
        </Typography>
        <Typography component="p">
          <strong>{t(contentKeys.strong)}</strong>
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          pb: 3,
          px: 3,
          gap: 1,
          flexWrap: "wrap",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          "& .MuiButton-root": {
            minHeight: 44,
            width: { xs: "100%", sm: "auto" },
          },
        }}
      >
        <Button id="playground-disclaimer-language-button" onClick={handleLanguageToggle}>
          {i18n.language === "en" ? t("disclaimer.modal.switchToFrench") : t("disclaimer.modal.switchToEnglish")}
        </Button>
        <Button
          id="playground-accept-disclaimer-button"
          color="primary"
          variant="contained"
          autoFocus
          onClick={handleAccept}
        >
          {t("disclaimer.modal.accept")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (typeof document !== "undefined") {
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot) {
      return createPortal(dialog, modalRoot);
    }
  }

  return dialog;
};

export default PlaygroundDisclaimerDialog;