/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface ToolState {
  enabledTools: Record<string, boolean>;
  isLoading: boolean;
  error: string | null;
}

const defaultEnabledTools: Record<string, boolean> = {
  code: true,
  image: true,
  web: false,
};

const initialState: ToolState = {
  enabledTools: defaultEnabledTools,
  isLoading: false,
  error: null,
};

const toolSlice = createSlice({
  name: "tools",
  initialState,
  reducers: {
    setEnabledTools: (state, action: PayloadAction<Record<string, boolean>>) => {
      // Overwrite the entire toggle set when the user saves new preferences.
      state.enabledTools = action.payload;
    },
    toggleTool: (state, action: PayloadAction<string>) => {
      const tool = action.payload;
      // Flip a single tool flag in-place to keep the UI responsive.
      state.enabledTools[tool] = !state.enabledTools[tool];
    },
  },
});

export const { setEnabledTools, toggleTool } = toolSlice.actions;
export default toolSlice.reducer;