/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 */

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Tool } from "openai/resources/responses/responses.mjs";

// Async thunk to load tools using the toolService
export const loadServers = createAsyncThunk('tools/loadServers', async (_, { rejectWithValue }) => {
  
  try {
    const rawValue = import.meta.env.VITE_MCP_SERVERS;
    if (!rawValue) return [];

    let rawServers: unknown;
    let toolServers: Tool.Mcp[] = [];

    rawServers = JSON.parse(rawValue);

    if (typeof rawServers === "string") {
      rawServers = JSON.parse(rawServers);
    }

    const serverEntries = Array.isArray(rawServers)
      ? rawServers
      : rawServers && typeof rawServers === "object" && Array.isArray((rawServers as { servers?: unknown[] }).servers)
        ? (rawServers as { servers: unknown[] }).servers
        : [];

    // Validate and map raw server data to Tool.Mcp objects
    toolServers = serverEntries
      .filter((server: any) => server && server.server_label && server.server_url && server.server_description)
      .map((server: any) => {
        const headers =
          server.headers && typeof server.headers === "object" && !Array.isArray(server.headers)
            ? Object.fromEntries(
                Object.entries(server.headers).filter(
                  ([key, value]) => typeof key === "string" && typeof value === "string"
                )
              )
            : undefined;

        return {
          server_label: server.server_label,
          type: 'mcp',
          server_url: server.server_url,
          server_description: server.server_description,
          require_approval: (server.require_approval === "always" || server.require_approval === "never")
            ? server.require_approval
            : "never",
          authorization: typeof server.authorization === "string" ? server.authorization : undefined,
          headers,
          allowed_tools: server.allowed_tools,
        } as Tool.Mcp;
      });

    return toolServers;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse MCP servers';
    console.error(message);
    return rejectWithValue(message);
  }
});

export interface ToolState {
  enabledTools: Record<string, boolean>;
  mcpServers: Tool.Mcp[];
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
      .addCase(loadServers.fulfilled, (state, action: PayloadAction<Tool.Mcp[]>) => {
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