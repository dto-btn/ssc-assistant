import React from "react";
import type { ThemeContextValue } from "./types";

/**
 * Shared context carrying the theme state plus toggle helpers.
 * Components should consume it through the `usePlaygroundTheme` hook to keep
 * error handling consistent.
 */
export const PlaygroundThemeContext = React.createContext<ThemeContextValue | undefined>(
  undefined
);

export function usePlaygroundTheme(): ThemeContextValue {
  const value = React.useContext(PlaygroundThemeContext);
  if (!value) {
    throw new Error("usePlaygroundTheme must be used within PlaygroundThemeProvider");
  }
  return value;
}
