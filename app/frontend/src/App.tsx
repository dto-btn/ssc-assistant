import { PublicClientApplication } from "@azure/msal-browser";
import React from "react";
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
  // Move scroll-lock from <body> to the child `#app-content` wrapper.
  // This watches for body.style changes (set by MUI) and applies overflow/padding to the wrapper instead.
  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const body = document.body;
    const appContent = document.getElementById('app-content');
    if (!appContent) return;

    const applyFromBody = () => {
      const overflow = body.style.overflow;
      const paddingRight = body.style.paddingRight;
      if (overflow === 'hidden') {
        if (!appContent.classList.contains('app-scroll-locked')) {
          appContent.classList.add('app-scroll-locked');
          if (paddingRight) appContent.style.paddingRight = paddingRight;
          body.style.overflow = '';
          body.style.paddingRight = '';
        }
      } else {
        if (appContent.classList.contains('app-scroll-locked')) {
          appContent.classList.remove('app-scroll-locked');
          appContent.style.paddingRight = '';
        }
      }
    };

    // initial sync
    applyFromBody();

    const mo = new MutationObserver(() => applyFromBody());
    mo.observe(body, { attributes: true, attributeFilter: ['style'] });
    return () => mo.disconnect();
  }, []);

  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input.
          On the playground page, #playground-ask-question is used; elsewhere #ask-question. */}
      <a
        className="skip-link"
        href="#playground-ask-question"
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
