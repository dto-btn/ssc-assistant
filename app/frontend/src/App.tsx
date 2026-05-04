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

interface AppProps {
  instance: PublicClientApplication;
}

const shouldBypassPlaygroundAuth = (): boolean => {
  return (
    import.meta.env.DEV &&
    import.meta.env.VITE_E2E_BYPASS_AUTH === "true" &&
    typeof window !== "undefined" &&
    window.location.pathname.startsWith("/playground")
  );
};

export const App = ({ instance }: AppProps) => {
  const isPlaygroundE2EAuthBypassEnabled = shouldBypassPlaygroundAuth();

  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input */}
      <a className="skip-link" href="#ask-question">Skip to chat input</a>
      <MSClarity />
      <CssBaseline />
      <AppErrorBoundary>
        <MsalProvider instance={instance}>
          {isPlaygroundE2EAuthBypassEnabled ? (
            <AppRoutes />
          ) : (
            <>
              <UnauthenticatedTemplate>
                <ConnectingScreen />
              </UnauthenticatedTemplate>
              <AuthenticatedTemplate>
                <AppRoutes />
              </AuthenticatedTemplate>
            </>
          )}
        </MsalProvider>
      </AppErrorBoundary>
      <AppSnackbars />
    </>
  );
};
