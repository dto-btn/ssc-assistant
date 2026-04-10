/**
 * UI slice
 *
 * Stores playground presentation state that is local to the browser session,
 * including sidebar collapse preference and temporary mobile drawer visibility.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

/**
 * UI-only preferences and transient view state for the playground shell.
 */
interface UiState {
  /** Persists desktop preference to hide/show the sidebar. */
  isSidebarCollapsed: boolean;
  /** Tracks temporary mobile drawer visibility for the current page session. */
  isMobileSidebarOpen: boolean;
  /** True strictly while a bulk session deletion is in-flight via the API. */
  isDeletingAllChats: boolean;
}

const initialState: UiState = {
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  isDeletingAllChats: false,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebarCollapsed: (state) => {
      // Desktop toggle used by the sidebar header control.
      state.isSidebarCollapsed = !state.isSidebarCollapsed;
    },
    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      // Used by the global open button in the chat area.
      state.isSidebarCollapsed = action.payload;
    },
    openMobileSidebar: (state) => {
      state.isMobileSidebarOpen = true;
    },
    closeMobileSidebar: (state) => {
      state.isMobileSidebarOpen = false;
    },
    setMobileSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.isMobileSidebarOpen = action.payload;
    },
    setIsDeletingAllChats: (state, action: PayloadAction<boolean>) => {
      state.isDeletingAllChats = action.payload;
    },
  },
});

export const {
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  openMobileSidebar,
  closeMobileSidebar,
  setMobileSidebarOpen,
  setIsDeletingAllChats,
} = uiSlice.actions;

export default uiSlice.reducer;
