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

interface AppProps {
  instance: PublicClientApplication;
}

export const App = ({ instance }: AppProps) => {
  return (
    <>
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
    </>
  );
};
