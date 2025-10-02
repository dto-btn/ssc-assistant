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
import { useEffect, useState } from "react";
import { callMsGraph } from "./graph";
import { UserContext, GraphData } from "./stores/UserContext";

interface AppProps {
  instance: PublicClientApplication;
}

export const App = ({ instance }: AppProps) => {
  const [userData, setUserData] = useState<{ graphData: GraphData; profilePictureURL: string }>({ graphData: null, profilePictureURL: "" });

  // Prefetch basic user data once auth templates are ready; this avoids a follow-up render inside MainScreen
  useEffect(() => {
    let mounted = true;
    callMsGraph().then((response) => {
      if (!mounted) return;
      setUserData({ graphData: response.graphData, profilePictureURL: response.profilePictureURL });
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, []);
  return (
    <>
      {/* Skip link for keyboard users to jump to the chat ask input */}
      <a className="skip-link" href="#ask-question">Skip to chat input</a>
      <MSClarity />
      <CssBaseline />
      <AppErrorBoundary>
        <MsalProvider instance={instance}>
          <UnauthenticatedTemplate>
            <ConnectingScreen />
          </UnauthenticatedTemplate>
          <AuthenticatedTemplate>
            <UserContext.Provider value={userData}>
              <AppRoutes />
            </UserContext.Provider>
          </AuthenticatedTemplate>
        </MsalProvider>
      </AppErrorBoundary>
      <AppSnackbars />
    </>
  );
};
