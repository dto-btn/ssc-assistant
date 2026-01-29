/**
 * Playground entry component
 *
 * This file exports the main `Playground` React component which wires together
 * UI pieces used for the interactive assistant playground used in development
 * and experimentation. It composes the root playground layout and connects
 * state and handlers from the playground store.
 */
// React import intentionally omitted; use named imports where required.
import { Provider } from "react-redux";
import { store } from "./store";
import PlaygroundRoot from "./components/PlaygroundRoot";
import ToastContainer from "./components/ToastContainer";
import { PlaygroundThemeProvider } from "./theme/PlaygroundThemeProvider";

export default function PlaygroundApp() {
  return (
    <Provider store={store}>
      <PlaygroundThemeProvider>
        <PlaygroundRoot />
        <ToastContainer />
      </PlaygroundThemeProvider>
    </Provider>
  );
}