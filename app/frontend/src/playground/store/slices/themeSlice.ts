import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PaletteMode } from "@mui/material";

export interface ThemeState {
  mode: PaletteMode;
  /** User's explicit preference, or null to follow system */
  userPreference: "light" | "dark" | null;
}

const initialState: ThemeState = {
  mode: "light",
  userPreference: null,
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setThemeMode: (state, action: PayloadAction<PaletteMode>) => {
      state.mode = action.payload;
      state.userPreference = action.payload as "light" | "dark";
      // Persist to localStorage
      localStorage.setItem("ssc-theme-preference", action.payload);
    },
    initializeThemeFromSystemPreference: (state, action: PayloadAction<boolean>) => {
      if (state.userPreference === null) {
        state.mode = action.payload ? "dark" : "light";
      }
    },
    loadThemeFromStorage: (state) => {
      const saved = localStorage.getItem("ssc-theme-preference");
      if (saved === "light" || saved === "dark") {
        state.mode = saved;
        state.userPreference = saved;
      }
    },
  },
});

export const { setThemeMode, initializeThemeFromSystemPreference, loadThemeFromStorage } = themeSlice.actions;
export default themeSlice.reducer;
