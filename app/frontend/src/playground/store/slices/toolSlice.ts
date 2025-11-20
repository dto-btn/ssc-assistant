/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 */

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { getToolService } from "../../services/toolService";
import { ChatCompletionFunctionTool } from 'openai/resources/index.mjs';

/**
 * Fetch the union of tools exposed by every configured MCP server.
 */
export const loadTools = createAsyncThunk('tools/loadTools', async (_, { rejectWithValue }) => {
  try {
    const toolService = await getToolService();
    const tools = await toolService.listTools();
    return tools;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load tools';
    return rejectWithValue(message);
  }
});

export interface ToolState {
  enabledTools: Record<string, boolean>;
  availableTools: ChatCompletionFunctionTool[];
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
  availableTools: [],
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
      .addCase(loadTools.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadTools.fulfilled, (state, action: PayloadAction<ChatCompletionFunctionTool[]>) => {
        state.isLoading = false;
        state.availableTools = action.payload;
      })
      .addCase(loadTools.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { setEnabledTools, toggleTool } = toolSlice.actions;
export default toolSlice.reducer;