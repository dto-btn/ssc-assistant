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
  // App renders above the router (see AppRoutes), so useLocation() isn't
  // available here. Read the pathname directly for the no-JS href fallback;
  // the onClick handler below still targets the live DOM for JS navigation.
  const isPlayground = window.location.pathname.startsWith("/playground");
  const skipLinkTargetId = isPlayground ? "playground-ask-question" : "ask-question";

  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input.
          On the playground page, #playground-ask-question is used; elsewhere #ask-question. */}
      <a
        className="skip-link"
        href={`#${skipLinkTargetId}`}
        onClick={(e) => {
          const target = document.getElementById(skipLinkTargetId);
          if (target) {
            e.preventDefault();
            target.focus();
          }
        }}
      >{t("skip.to.chat.input")}</a>

      <MSClarity />
      <CssBaseline />
      <div id="app-content">
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
      </div>
      <AppSnackbars />
    </>
  );
};
