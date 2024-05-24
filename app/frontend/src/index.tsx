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
import { msalConfig, loginRequest } from './authConfig.ts';

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  // msalInstance.addEventCallback((event: EventMessage) => {
  //   if (event.eventType === EventType.LOGIN_SUCCESS && event.payload) {
  //       const payload = event.payload as AuthenticationResult;
  //       const account = payload.account;
  //       msalInstance.setActiveAccount(account);
  //   }
  // });

  msalInstance.handleRedirectPromise().then((response) => {
    console.debug("index.tsx: handleRedirectPromise --> start");
    if (response && response.account) {
      console.debug("index.tsx: handleRedirectPromise --> found account we will use:");
      console.debug(response.account);
      msalInstance.setActiveAccount(response.account);
    } else {
      // scope it to this tenant only.
      const currentAccounts = msalInstance.getAllAccounts({tenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID});
      if (currentAccounts.length === 0) {
        console.debug("index.tsx: handleRedirectPromise --> no account(s) found, need to login with redirect");
        msalInstance.loginRedirect(loginRequest);
      } else {
        console.debug("index.tsx: handleRedirectPromise --> account(s) found");
        console.debug(currentAccounts[0]);
        msalInstance.setActiveAccount(currentAccounts[0]);
      }
    }
  }).catch((error) => {
    console.error('Redirect error:', error);
  });
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