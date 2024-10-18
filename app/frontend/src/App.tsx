import { PublicClientApplication } from "@azure/msal-browser";
import {
  AuthenticatedTemplate,
  UnauthenticatedTemplate
} from "@azure/msal-react";
import ConnectingScreen from "./screens/ConnectingScreen";
import MainScreen from "./screens/MainScreen";
import { MsalProvider } from "@azure/msal-react";

interface AppProps {
  instance: PublicClientApplication;
}

export const App = ({instance}: AppProps) => {
  return (
    <MsalProvider instance={instance}>
      <UnauthenticatedTemplate>
        <ConnectingScreen />
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <MainScreen/>
      </AuthenticatedTemplate>
    </MsalProvider>
  );
};
