/**
 * Playground-scoped MUI theme.
 *
 * Extends the shared application `theme` (src/theme.ts) with consistent,
 * WCAG-compliant focus indicators for keyboard users. Scoping these overrides
 * to the playground keeps the legacy application's appearance unchanged while
 * guaranteeing every interactive element in the playground exposes a visible
 * focus ring.
 *
 * WCAG 2.4.7 (Focus Visible) and 1.4.11 (Non-text Contrast): the outline is a
 * solid 2px ring offset from the control so it reads as a shape change rather
 * than a colour-only change, and uses the high-contrast brand purple which
 * exceeds the 3:1 contrast ratio against the light playground surfaces.
 *
 * Controls rendered on the dark TopBar gradient cannot use this purple ring
 * (it would be invisible), so those components opt into a white outline
 * locally in TopBar.tsx.
 */
import { createTheme } from "@mui/material";
import { theme } from "../theme";

/** Shared focus-visible ring used across light playground surfaces. */
const focusVisibleRing = {
  outline: `2px solid ${theme.palette.primary.main}`,
  outlineOffset: "2px",
} as const;

export const playgroundTheme = createTheme(theme, {
  components: {
    MuiIconButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": focusVisibleRing,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": focusVisibleRing,
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            ...focusVisibleRing,
            outlineOffset: "-2px",
          },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          "&:focus-visible": {
            ...focusVisibleRing,
            outlineOffset: "-2px",
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          "&:focus-visible": focusVisibleRing,
        },
      },
    },
  },
});
