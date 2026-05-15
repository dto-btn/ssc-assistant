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

  const shouldShow = currentDisclaimer !== null;

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

  if (!currentDisclaimer) {
    return null;
  }

  const contentKeys = CONTENT_KEYS[currentDisclaimer];
  const descriptionId = "playground-disclaimer-description";

  return (
    <Dialog
      open={shouldShow}
      fullWidth
      maxWidth="md"
      fullScreen={isSmallScreen}
      aria-labelledby="playground-disclaimer-title"
      aria-describedby={descriptionId}
    >
      <DialogTitle id="playground-disclaimer-title">{t(contentKeys.title)}</DialogTitle>
      <DialogContent>
        <Typography id={descriptionId} component="p" sx={{ mb: 3 }}>
          {t(contentKeys.body)}
        </Typography>
        <Typography component="p" sx={{ fontWeight: 700 }}>
          {t(contentKeys.strong)}
        </Typography>
      </DialogContent>
      <DialogActions
        sx={{
          pb: 3,
          px: 3,
          gap: 1,
          flexWrap: "wrap",
          flexDirection: { xs: "column-reverse", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          "& .MuiButton-root": {
            minHeight: 44,
            width: { xs: "100%", sm: "auto" },
          },
        }}
      >
        <Button
          id="playground-accept-disclaimer-button"
          color="primary"
          variant="contained"
          onClick={handleAccept}
        >
          {t("disclaimer.modal.accept")}
        </Button>
        <Button id="playground-disclaimer-language-button" onClick={handleLanguageToggle}>
          {i18n.language === "en" ? t("disclaimer.modal.switchToFrench") : t("disclaimer.modal.switchToEnglish")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlaygroundDisclaimerDialog;