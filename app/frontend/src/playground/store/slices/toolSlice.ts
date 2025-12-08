/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 */

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Tool } from "openai/resources/responses/responses.mjs";

// Async thunk to load tools using the toolService
export const loadServers = createAsyncThunk('tools/loadServers', async (token: string, { rejectWithValue }) => {
  try {
    const rawServers = import.meta.env.VITE_MCP_SERVERS ? JSON.parse(import.meta.env.VITE_MCP_SERVERS) : [];

    const mcpServers = rawServers.map((server: Tool) => ({
      ...server,
      authorization: token,
    }));

    return mcpServers;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse MCP servers';
    return rejectWithValue(message);
  }
});

export interface ToolState {
  enabledTools: Record<string, boolean>;
  mcpServers: Tool[];
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
  mcpServers: [],
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
  extraReducers: (builder) => {
    builder
      .addCase(loadServers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadServers.fulfilled, (state, action: PayloadAction<Tool[]>) => {
        state.isLoading = false;
        state.mcpServers = action.payload;
      })
      .addCase(loadServers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setEnabledTools, toggleTool } = toolSlice.actions;
export default toolSlice.reducer;