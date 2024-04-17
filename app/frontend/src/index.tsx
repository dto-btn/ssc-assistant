import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./i18n";
import "./index.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { MsalProvider } from "@azure/msal-react";
import { AuthenticationResult, EventMessage, EventType, PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from './authConfig.ts';

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  // Account selection logic is app dependent. Adjust as needed for different use cases.
  const accounts = msalInstance.getAllAccounts();
  if (accounts.length > 0) {
      msalInstance.setActiveAccount(accounts[0]);
  }

  msalInstance.addEventCallback((event: EventMessage) => {
      if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
          const payload = event.payload as AuthenticationResult;
          const account = payload.account;
          msalInstance.setActiveAccount(account);
      }
  });

  const root = ReactDOM.createRoot(
      document.getElementById("root") as HTMLElement
  );
  root.render(
    <React.StrictMode>
      <MsalProvider instance={msalInstance}>
        <App />
      </MsalProvider>
    </React.StrictMode>
  );
});