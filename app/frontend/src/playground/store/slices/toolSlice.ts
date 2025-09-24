/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ToolState {
  enabledTools: Record<string, boolean>;
}

const defaultEnabledTools: Record<string, boolean> = {
  code: true,
  image: true,
  web: false,
};

const initialState: ToolState = {
  enabledTools: defaultEnabledTools,
};

const toolSlice = createSlice({
  name: "tools",
  initialState,
  reducers: {
    setEnabledTools: (state, action: PayloadAction<Record<string, boolean>>) => {
      state.enabledTools = action.payload;
    },
    toggleTool: (state, action: PayloadAction<string>) => {
      const tool = action.payload;
      state.enabledTools[tool] = !state.enabledTools[tool];
    },
  },
});

export const { setEnabledTools, toggleTool } = toolSlice.actions;
export default toolSlice.reducer;