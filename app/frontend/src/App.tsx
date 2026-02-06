import { PublicClientApplication } from "@azure/msal-browser";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate,
} from "@azure/msal-react";
import { useEffect, useState } from "react";
import ConnectingScreen from "./screens/ConnectingScreen";
import KeycloakConnectingScreen from "./screens/KeycloakConnectingScreen";
import { MsalProvider } from "@azure/msal-react";
import { AppErrorBoundary } from ".//AppErrorBoundary";
import { CssBaseline } from "@mui/material";
import { AppRoutes } from "./routes/AppRoutes";
import PlaygroundApp from "./playground/Playground";
import MSClarity from "./components/MSClarity";
import { AppSnackbars } from "./components/AppSnackbar";
import { initKeycloak } from "./auth/keycloak";

interface AppProps {
  instance?: PublicClientApplication;
}

const authProvider = (import.meta.env.VITE_AUTH_PROVIDER as string) || "msal";

export const App = ({ instance }: AppProps) => {
  const [keycloakReady, setKeycloakReady] = useState(false);
  const isPlayground = window.location.pathname.startsWith("/playground");

  useEffect(() => {
    if (authProvider !== "keycloak" || !isPlayground) {
      return;
    }

    initKeycloak()
      .then((authenticated) => {
        setKeycloakReady(authenticated);
      })
      .catch((error) => {
        console.error("Keycloak initialization failed", error);
        setKeycloakReady(false);
      });
  }, [isPlayground]);

  if (authProvider === "keycloak" && isPlayground) {
    return (
      <>
        {/* Skip link for keyboard users to jump to the chat ask input */}
        <a className="skip-link" href="#ask-question">Skip to chat input</a>
        <MSClarity />
        <CssBaseline />
        <AppErrorBoundary>
          {keycloakReady ? <PlaygroundApp /> : <KeycloakConnectingScreen />}
        </AppErrorBoundary>
        <AppSnackbars />
      </>
    );
  }
  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input */}
      <a className="skip-link" href="#ask-question">Skip to chat input</a>
      <MSClarity />
      <CssBaseline />
      <AppErrorBoundary>
        <MsalProvider instance={instance as PublicClientApplication}>
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
