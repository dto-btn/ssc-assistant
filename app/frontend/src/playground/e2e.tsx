import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";

import "../i18n";
import "../index.css";
import "@fontsource/roboto/300.css";
import "@fontsource/roboto/400.css";
import "@fontsource/roboto/500.css";
import "@fontsource/roboto/700.css";

import { AppErrorBoundary } from "../AppErrorBoundary";
import { theme } from "../theme";
import { PlaygroundProviders } from "./Playground";
import PlaygroundE2ERoot from "./e2e/PlaygroundE2ERoot";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppErrorBoundary>
        <PlaygroundProviders>
          <PlaygroundE2ERoot />
        </PlaygroundProviders>
      </AppErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>,
);