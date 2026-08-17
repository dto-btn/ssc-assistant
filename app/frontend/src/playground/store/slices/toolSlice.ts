/**
 * Tool slice
 *
 * Tracks which external tools (if any) are enabled for the playground and
 * stores tool-related metadata used by the middleware and UI components.
 *
 * Validates MCP URLs strictly so orchestrator-provided endpoints cannot route
 * to unsupported transports or paths.
 */

import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Tool } from "openai/resources/responses/responses.mjs";
import { msalInstance } from "../../../msalInstance";
import { apiUse } from "../../../authConfig";

/**
 * Allow insecure transport only for local development loopback MCP endpoints.
 */
const isLocalHttpMcpUrl = (parsed: URL): boolean => {
  const host = parsed.hostname.toLowerCase();
  return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(host);
};

/**
 * Validate MCP server URLs accepted by the playground.
 *
 * Accepted forms:
 * - `https://.../mcp`
 * - `http://localhost|127.0.0.1/.../mcp` during dev
 */
export const isValidMcpUrl = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    if (!/\/mcp\/?$/i.test(parsed.pathname)) {
      return false;
    }
    if (parsed.protocol === "https:") {
      return true;
    }
    return import.meta.env.DEV && isLocalHttpMcpUrl(parsed);
  } catch {
    return false;
  }
};

// Async thunk to load tools using the toolService
/**
 * Load MCP server definitions from the API backend.
 *
 * The backend owns the registry and returns a sanitized catalog (ids/labels only, no
 * URLs). Each server is referenced by an opaque `mcpref:<id>` ref; the API proxy expands
 * it to the real endpoint server-side, so the browser never holds internal MCP URLs.
 */
export const loadServers = createAsyncThunk('tools/loadServers', async (_, { rejectWithValue }) => {

  try {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      // Auth not ready yet; the catalog is re-loaded once an account becomes active.
      return [];
    }

    const { accessToken } = await msalInstance.acquireTokenSilent({ ...apiUse, account });

    const response = await fetch("/api/playground/mcp-servers", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      return rejectWithValue(`Failed to load MCP servers (${response.status})`);
    }

    const data = (await response.json()) as { servers?: unknown };
    const rawServers = Array.isArray(data.servers) ? data.servers : [];

    // Validate and map sanitized server data to opaque-ref Tool.Mcp objects.
    const toolServers: Tool.Mcp[] = (rawServers as unknown[])
      .filter(
        (server): server is Record<string, unknown> =>
          !!server &&
          typeof server === "object" &&
          typeof (server as Record<string, unknown>).id === "string" &&
          typeof (server as Record<string, unknown>).server_label === "string" &&
          typeof (server as Record<string, unknown>).server_description === "string"
      )
      .map((server) => ({
        server_label: server.server_label as string,
        type: 'mcp' as const,
        // Opaque ref resolved to a real endpoint by the API backend proxy.
        server_url: `mcpref:${server.id as string}`,
        server_description: server.server_description as string,
        // Default to never so unsupported values do not break tool execution.
        require_approval: (server.require_approval === "always" || server.require_approval === "never")
          ? server.require_approval as "always" | "never"
          : "never" as const,
      }));

    return toolServers;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load MCP servers';
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