import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.tsx";
import "./i18n";
import "./index.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { PublicClientApplication, EventType, AccountInfo, EventMessage } from "@azure/msal-browser";
import { msalConfig } from './authConfig.ts';

import { ThemeProvider, createTheme } from "@mui/material/styles";

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: "white",
    },
  },
});

export const msalInstance = new PublicClientApplication(msalConfig);

msalInstance.initialize().then(() => {
  console.debug("msalInstance -> Initialisation...");
  // Default to using the first account if no account is active on page load
  const currentAccounts = msalInstance.getAllAccounts({tenantId: import.meta.env.VITE_AZURE_AD_TENANT_ID})
  if (!msalInstance.getActiveAccount() && currentAccounts.length > 0) {
    // Account selection logic is app dependent. Adjust as needed for different use cases.
    msalInstance.setActiveAccount(currentAccounts[0]);
    console.debug("msalInstance -> Found an active account from filtered tenant. Will use it to connect to the application.");
  }

  // Optional - This will update account state if a user signs in from another tab or window
  msalInstance.enableAccountStorageEvents();

  msalInstance.addEventCallback((event: EventMessage) => {
    console.debug("msalInstance -> In addEventCallback(), EvenType = " + event.eventType);
    if ((event.eventType === EventType.LOGIN_SUCCESS || event.eventType === EventType.SSO_SILENT_SUCCESS) && event.payload) {
      const account = event.payload as AccountInfo;
      msalInstance.setActiveAccount(account);
      console.debug("msalInstance -> In addEventCallback(), Login success detected, using payload account.");
    }
  });

  const root = ReactDOM.createRoot(
    document.getElementById("root") as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <ThemeProvider theme={mainTheme}>
          <App instance={msalInstance} />
      </ThemeProvider>
    </React.StrictMode>
  );
});