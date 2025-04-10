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

export const Disclaimer = () => {
  const { t } = useTranslation();
  const [hideDialog, setHideDialog] = useState(true);
  const { inProgress } = useMsal();
  const appStore = useAppStore();

  useEffect(() => {
    const disclaimerAccepted = Cookies.get("disclaimer_accepted");
    if (!disclaimerAccepted && inProgress === InteractionStatus.None) {
      setHideDialog(false);
    }
  }, []);

  const handleAccept = () => {
    setDisclaimerCookie();
    setHideDialog(true);
  };

  const setDisclaimerCookie = () => {
    Cookies.set("disclaimer_accepted", "true", {
      expires: 30 // 30 days
    });
  };

  return (
    <div>
      <Dialog open={!hideDialog} fullWidth>
        <DialogTitle>{t("disclaimer")}</DialogTitle>
        <DialogContent>
          <p>{t("disclaimer.desc")}</p>
          <p style={{ fontWeight: "bold" }}>{t("disclaimer.desc2")}</p>
        </DialogContent>
        <DialogActions>
          <Button
            style={{ backgroundColor: "#4b3e99", color: "white" }}
            onClick={handleAccept}
          >
            {t("accept")}
          </Button>
          <Button
            onClick={() => { appStore.languageService.changeLanguage() }}
          >
            {t("langlink")}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};
