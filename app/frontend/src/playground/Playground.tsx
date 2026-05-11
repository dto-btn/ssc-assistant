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
import { store } from "./store";
import PlaygroundRoot from "./components/PlaygroundRoot";
import ToastContainer from "./components/ToastContainer";

export function PlaygroundProviders({ children }: PropsWithChildren) {
  return (
    <Provider store={store}>
      {children}
      <ToastContainer />
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