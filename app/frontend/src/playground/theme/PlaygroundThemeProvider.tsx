import React from "react";
/**
 * PlaygroundThemeProvider wires the playground into a shared light/dark theme.
 * It exposes CSS variables plus a MUI palette so custom components and
 * Material UI stay visually aligned, all while honoring WCAG contrast goals.
 */
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import type { PaletteMode } from "@mui/material";
import "./theme.css";
import type { PlaygroundTheme } from "./types";
import { PlaygroundThemeContext } from "./themeContext";

const STORAGE_KEY = "playground-theme";

// Pull a persisted preference; treat anything else as "unset" so we can fall back.
function getStoredTheme(): PlaygroundTheme | null {
  if (typeof window === "undefined") {
    return null;
  }
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : null;
}

// Default to stored preference, otherwise mirror the system color scheme when possible.
function getPreferredTheme(): PlaygroundTheme {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = getStoredTheme();
  if (stored) {
    return stored;
  }
  if (typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// Central point for palette tweaks so components do not hard-code colors.
function buildMuiTheme(mode: PaletteMode) {
  const isDark = mode === "dark";
  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? "#60a5fa" : "#1d4ed8",
      },
      secondary: {
        main: isDark ? "#a78bfa" : "#9333ea",
      },
      background: {
        default: isDark ? "#0b1120" : "#f8fafc",
        paper: isDark ? "#111827" : "#ffffff",
      },
      text: {
        primary: isDark ? "#f8fafc" : "#111827",
        secondary: isDark ? "#cbd5f5" : "#475467",
      },
      divider: isDark ? "rgba(226,232,240,0.2)" : "rgba(15,23,42,0.14)",
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            fontSize: "0.85rem",
            fontWeight: 500,
          },
        },
      },
    },
  });
}

export const PlaygroundThemeProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [theme, setThemeState] = React.useState<PlaygroundTheme>(getPreferredTheme);
  const [hasStoredPreference, setHasStoredPreference] = React.useState<boolean>(
    () => Boolean(getStoredTheme())
  );

  // Keep html[data-playground-theme] synced so CSS variables can react instantly.
  const applyThemeAttribute = React.useCallback((mode: PlaygroundTheme) => {
    if (typeof document === "undefined") {
      return;
    }
    document.documentElement.dataset.playgroundTheme = mode;
    document.documentElement.style.colorScheme = mode;
  }, []);

  React.useEffect(() => {
    applyThemeAttribute(theme);
  }, [applyThemeAttribute, theme]);

  // When no explicit preference is stored, stay in sync with the OS setting.
  React.useEffect(() => {
    if (typeof window === "undefined" || hasStoredPreference) {
      return undefined;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => {
      setThemeState(event.matches ? "dark" : "light");
    };
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handler);
      return () => media.removeEventListener("change", handler);
    }
    media.addListener(handler);
    return () => media.removeListener(handler);
  }, [hasStoredPreference]);

  const persistPreference = React.useCallback((mode: PlaygroundTheme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, mode);
    }
    setHasStoredPreference(true);
  }, []);

  const setTheme = React.useCallback(
    (next: PlaygroundTheme) => {
      setThemeState(next);
      persistPreference(next);
    },
    [persistPreference]
  );

  const toggleTheme = React.useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      persistPreference(next);
      return next;
    });
  }, [persistPreference]);

  const contextValue = React.useMemo(() => ({ theme, toggleTheme, setTheme }), [
    theme,
    toggleTheme,
    setTheme,
  ]);

  const muiTheme = React.useMemo(() => buildMuiTheme(theme), [theme]);

  return (
    <PlaygroundThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </PlaygroundThemeContext.Provider>
  );
};
