/**
 * Playground entry component
 *
 * This file exports the main `Playground` React component which wires together
 * UI pieces used for the interactive assistant playground used in development
 * and experimentation. It composes the root playground layout and connects
 * state and handlers from the playground store.
 */
import { useMemo, useEffect } from "react";
import { CssBaseline, ThemeProvider, useMediaQuery } from "@mui/material";
import type { PaletteMode } from "@mui/material";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store } from "./store";
import PlaygroundRoot from "./components/PlaygroundRoot";
import ToastContainer from "./components/ToastContainer";
import { createAppTheme } from "./theme";
import { setThemeMode, initializeThemeFromSystemPreference } from "./store/slices/themeSlice";
import type { RootState, AppDispatch } from "./store";

function PlaygroundAppInner() {
  const dispatch = useDispatch<AppDispatch>();
  const { mode: themeMode, userPreference } = useSelector((state: RootState) => state.theme);
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)", {
    noSsr: true,
  });

  // Initialize from system preference on first load
  useEffect(() => {
    if (userPreference === null) {
      dispatch(initializeThemeFromSystemPreference(systemPrefersDark));
    }
  }, [systemPrefersDark, userPreference, dispatch]);

  const playgroundTheme = useMemo(() => createAppTheme(themeMode), [themeMode]);

  const handleToggleTheme = () => {
    const nextTheme: PaletteMode = themeMode === "dark" ? "light" : "dark";
    dispatch(setThemeMode(nextTheme));
  };

  return (
    <ThemeProvider theme={playgroundTheme}>
      <CssBaseline enableColorScheme />
      <PlaygroundRoot themeMode={themeMode} onToggleTheme={handleToggleTheme} />
      <ToastContainer />
    </ThemeProvider>
  );
}

export default function PlaygroundApp() {
  return (
    <Provider store={store}>
      <PlaygroundAppInner />
    </Provider>
  );
}
