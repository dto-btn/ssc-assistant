import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
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

  return (
    <div>
      <Dialog open={shouldShow} fullWidth>
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
            color='primary'
            variant='contained'
            onClick={() => handleAccept(currentDisclaimerConfig.key)}
          >
            {t("accept")}
          </Button>
          <Button
            onClick={() => {
              appStore.languageService.changeLanguage();
            }}
          >
            {t("langlink")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
