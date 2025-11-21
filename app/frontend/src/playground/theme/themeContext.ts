import React from "react";
import type { ThemeContextValue } from "./types";

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
