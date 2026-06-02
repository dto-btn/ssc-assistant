import { PublicClientApplication } from "@azure/msal-browser";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import ConnectingScreen from "./screens/ConnectingScreen";
import { MsalProvider } from "@azure/msal-react";
import { AppErrorBoundary } from ".//AppErrorBoundary";
import { CssBaseline } from "@mui/material";
import { AppRoutes } from "./routes/AppRoutes";
import MSClarity from "./components/MSClarity";
import { AppSnackbars } from "./components/AppSnackbar";
import { useTranslation } from "react-i18next";

interface AppProps {
  instance: PublicClientApplication;
}

export const App = ({ instance }: AppProps) => {
  const { t } = useTranslation();
  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input.
          On the playground page, #playground-ask-question is used; elsewhere #ask-question. */}
      <a
        className="skip-link"
        href="#ask-question"
        onClick={(e) => {
          const target =
            document.getElementById("playground-ask-question") ??
            document.getElementById("ask-question");
          if (target) {
            e.preventDefault();
            target.focus();
          }
        }}
      >{t("skip.to.chat.input")}</a>
      <MSClarity />
      <CssBaseline />
      <AppErrorBoundary>
        <MsalProvider instance={instance}>
          <UnauthenticatedTemplate>
            <ConnectingScreen />
          </UnauthenticatedTemplate>
          <AuthenticatedTemplate>
            <AppRoutes />
          </AuthenticatedTemplate>
        </MsalProvider>
      </AppErrorBoundary>
      <AppSnackbars />
    </>
  );
};
