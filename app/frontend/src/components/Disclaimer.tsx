import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useAppStore } from "../stores/AppStore";
import { allowedToolsSet } from "../allowedTools";
import { DisclaimerKey, DisclaimerState } from "../../types";
import { PersistenceUtils } from '../util/persistence';

interface DisclaimerConfig {
  key: DisclaimerKey;
  text: string;
  text2: string;
  title?: string;
  cookieName: string;
  // Additional properties for when to require acceptance of the disclaimer
  requiredWhen?: () => boolean;
}

const DISCLAIMER_CONFIG: DisclaimerConfig[] = [
  {
    key: DisclaimerKey.main,
    text: "disclaimer.desc",
    text2: "disclaimer.desc2",
    cookieName: "disclaimer_accepted",
  },
  {
    key: DisclaimerKey.br,
    text: "br.disclaimer",
    text2: "br.disclaimer2",
    title: "bits",
    cookieName: "br_disclaimer_accepted",
    requiredWhen: () => allowedToolsSet.has("bits"),
  }
]

export const Disclaimer = () => {
  const { t } = useTranslation();
  const { inProgress } = useMsal();
  const appStore = useAppStore();

  // Keep track of the disclaimers and their acceptance state
  const [disclaimerAcceptedState, setDisclaimerAcceptedState] = useState<DisclaimerState>(
    () => PersistenceUtils.getDisclaimerAcceptedState()
  );

  // Find the first disclaimer that is not accepted, based on disclaimerAcceptedState
  const [currentDisclaimerKey, setCurrentDisclaimerKey] = useState<DisclaimerKey | null>(null);
  useEffect(() => {
    const currentDisclaimer = DISCLAIMER_CONFIG.find((d) => {
      const isAccepted = disclaimerAcceptedState[d.key];
      const meetsConditions = !d.requiredWhen || d.requiredWhen();
      return !isAccepted && meetsConditions;
    });
    setCurrentDisclaimerKey(currentDisclaimer?.key || null);
  }, [disclaimerAcceptedState]);

  const shouldShow = !!currentDisclaimerKey && inProgress === InteractionStatus.None;

  // When the disclaimer dialog is visible, mark the application root as inert
  // so that assistive technology and focus are not blocked by aria-hidden on ancestors.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.getElementById('root');
    const modalRoot = document.getElementById('modal-root');
    if (!root) return;
    if (shouldShow) {
      try {
        (root as any).inert = true;
      } catch (e) {
        // inert might not be supported; best-effort only
      }
      if (modalRoot) {
        modalRoot.removeAttribute('aria-hidden');
      }
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
  }, [shouldShow]);

  const handleAccept = (key: DisclaimerKey) => {
    PersistenceUtils.setDisclaimerAccepted(key);
    setDisclaimerAcceptedState((prevState) => ({
      ...prevState,
      [key]: true,
    }));
  };

  const currentDisclaimerConfig = DISCLAIMER_CONFIG.find((d) => d.key === currentDisclaimerKey);

  if (!currentDisclaimerConfig) {
    return null; // No configuration found for the current disclaimer
  }

  const dialog = (
    <Dialog open={shouldShow} fullWidth disableScrollLock disablePortal>
      <DialogTitle>
        {currentDisclaimerConfig?.title
          ? t("disclaimer") + " - " + t(currentDisclaimerConfig.title)
          : t("disclaimer")}
      </DialogTitle>
      <DialogContent>
        {currentDisclaimerConfig?.text && <p>{t(currentDisclaimerConfig.text)}</p>}
        {currentDisclaimerConfig?.text2 && (
          <p style={{ fontWeight: "bold" }}>{t(currentDisclaimerConfig.text2)}</p>
        )}
      </DialogContent>
      <DialogActions>
        <Button
          id="accept-disclaimer-button"
          color='primary'
          variant='contained'
          onClick={() => handleAccept(currentDisclaimerConfig.key)}
        >
          {t("accept")}
        </Button>
        <Button
          id="change-language-button"
          onClick={() => {
            appStore.languageService.changeLanguage();
          }}
        >
          {t("langlink")}
        </Button>
      </DialogActions>
    </Dialog>
  );

  if (typeof document !== "undefined") {
    const modalRoot = document.getElementById("modal-root");
    if (modalRoot) return createPortal(dialog, modalRoot);
  }

  return dialog;
};
