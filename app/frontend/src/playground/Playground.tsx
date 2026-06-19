/**
 * Playground entry component
 *
 * This file exports the main `Playground` React component which wires together
 * UI pieces used for the interactive assistant playground used in development
 * and experimentation. It composes the root playground layout and connects
 * state and handlers from the playground store.
 */
// React import intentionally omitted; use named imports where required.
import type { PropsWithChildren } from "react";
import { Provider } from "react-redux";
import { ThemeProvider } from "@mui/material/styles";
import { store } from "./store";
import { playgroundTheme } from "./theme";
import PlaygroundRoot from "./components/PlaygroundRoot";
import ToastContainer from "./components/ToastContainer";

export function PlaygroundProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      {/* Playground-scoped theme adds consistent focus indicators (WCAG 2.4.7)
          without affecting the legacy application's shared theme. */}
      <ThemeProvider theme={playgroundTheme}>
        {children}
        <ToastContainer />
      </ThemeProvider>
    </Provider>
  );
}

export default function PlaygroundApp() {
  return (
    <PlaygroundProviders>
      <PlaygroundRoot />
    </PlaygroundProviders>
  );
}