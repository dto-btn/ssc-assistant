import { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import Cookies from "js-cookie";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useAppStore } from "../stores/AppStore";
import { allowedToolsSet } from "../allowedTools";

interface Disclaimer {
  key: string;
  text: string;
  text2: string;
  cookieName: string;
  accepted: boolean;
}

export const Disclaimer = () => {
  const { t } = useTranslation();
  const [hideDialog, setHideDialog] = useState(true);
  const { inProgress } = useMsal();
  const appStore = useAppStore();

  const brEnabled: boolean = allowedToolsSet.has("bits");
  const [disclaimers, setDisclaimers] = useState<Disclaimer[]>([
    {
      key: "main",
      text: "disclaimer.desc",
      text2: "disclaimer.desc2",
      cookieName: "disclaimer_accepted",
      accepted: Cookies.get("disclaimer_accepted") === "true",
    },
    {
      key: "br",
      text: "br.disclaimer",
      text2: "br.disclaimer2",
      cookieName: "br_disclaimer_accepted",
      accepted: brEnabled
        ? Cookies.get("br_disclaimer_accepted") === "true"
        : true,
    },
  ]);

  // Find the first unaccepted disclaimer
  const currentDisclaimer = disclaimers.find((d) => !d.accepted);

  useEffect(() => {
    if (
      !disclaimers.every((d) => d.accepted) &&
      inProgress === InteractionStatus.None
    ) {
      setHideDialog(false);
    }
  }, [disclaimers, inProgress]);

  const handleAccept = (key: string) => {
    const updatedDisclaimers = disclaimers.map((d) => {
      if (d.key === key) {
        setDisclaimerCookie(d.cookieName); // Call your function here
        return { ...d, accepted: true };
      }
      return d;
    });
    setDisclaimers(updatedDisclaimers);
  };

  const setDisclaimerCookie = (cookie_name: string) => {
    Cookies.set(cookie_name, "true", {
      expires: 30, // 30 days
    });
  };

  return (
    <div>
      <Dialog open={!hideDialog && !!currentDisclaimer} fullWidth>
        <DialogTitle>{t("disclaimer")}</DialogTitle>
        <DialogContent>
          {currentDisclaimer?.text && <p>{t(currentDisclaimer.text)}</p>}
          {currentDisclaimer?.text2 && (
            <p style={{ fontWeight: "bold" }}>{t(currentDisclaimer.text2)}</p>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            style={{ backgroundColor: "#4b3e99", color: "white" }}
            onClick={() =>
              currentDisclaimer && handleAccept(currentDisclaimer.key)
            }
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
