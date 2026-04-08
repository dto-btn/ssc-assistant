/**
 * Chat slice
 *
 * Redux slice that stores chat messages and related metadata for the
 * playground. Exposes actions for adding messages, updating status, and
 * clearing chat history.
 *
 * This state carries orchestrator routing insights, progress events, and
 * selected MCP targets per session.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { v4 as uuidv4 } from "uuid";
import { FileAttachment } from "../../types";

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  attachments?: FileAttachment[];
  citations?: { title: string; url: string }[];
  mcpAttribution?: MessageMcpAttribution;
}

export interface MessageMcpAttributionServer {
  serverLabel: string;
  serverUrl?: string;
}

/**
 * Snapshot of MCP routing used for an individual assistant response.
 */
export interface MessageMcpAttribution {
  source: "live";
  generatedAt: string;
  category?: string;
  status?: OrchestratorProgressUpdate["status"];
  statusMessage?: string;
  servers: MessageMcpAttributionServer[];
}

export interface OrchestratorRecommendation {
  mcp_server_id: string;
  endpoint?: string;
  category?: string;
  confidence?: number;
  matched_keywords?: string[];
  classification_method?: string;
  rationale?: string;
}

/**
 * Lifecycle updates emitted while the orchestrator is classifying/routing.
 */
export interface OrchestratorProgressUpdate {
  status: "connecting" | "connected" | "classifying" | "routing" | "done" | "error";
  message: string;
  timestamp: string;
  transport?: "streamable-http";
}

/**
 * Persisted routing metadata for the active chat turn.
 */
export interface OrchestratorInsights {
  category: string;
  recommendations: OrchestratorRecommendation[];
  classificationMethod?: string;
  status?: OrchestratorProgressUpdate["status"];
  statusMessage?: string;
  progressUpdates?: OrchestratorProgressUpdate[];
  selectedServers?: Array<{
    server_label: string;
    server_url: string;
  }>;
  fallbackReason?: string;
  fallbackUpstream?: string | null;
  source: "orchestrator";
  transport?: "streamable-http" | "sse";
  timestamp: string;
  error?: string;
}

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  // Keyed by session id so each tab/session can show independent routing state.
  orchestratorInsightsBySessionId: Record<string, OrchestratorInsights | undefined>;
}

const ensureOrchestratorInsightsMap = (
  state: ChatState,
): Record<string, OrchestratorInsights | undefined> => {
  if (!state.orchestratorInsightsBySessionId) {
    state.orchestratorInsightsBySessionId = {};
  }
  return state.orchestratorInsightsBySessionId;
};

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  orchestratorInsightsBySessionId: {},
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    addMessage: (state, action: PayloadAction<Omit<Message, "id" | "timestamp">>) => {
      state.messages.push({
        ...action.payload,
        id: uuidv4(),
        timestamp: Date.now(),
      });
    },
    deleteMessage: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter((message) => message.id !== action.payload);
    },
    clearSessionMessages: (state, action: PayloadAction<string>) => {
      state.messages = state.messages.filter(
        (message) => message.sessionId !== action.payload
      );
    },
    updateMessageContent: (state, action: PayloadAction<{ messageId: string; content: string }>) => {
      const { messageId, content } = action.payload;
      const message = state.messages.find(msg => msg.id === messageId);
      if (message) {
        message.content = content;
      }
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setOrchestratorInsights: (
      state,
      action: PayloadAction<{ sessionId: string; insights: OrchestratorInsights | null }>
    ) => {
      const { sessionId, insights } = action.payload;
      const insightsBySessionId = ensureOrchestratorInsightsMap(state);
      // Null indicates the caller wants to clear current orchestrator metadata.
      if (!insights) {
        delete insightsBySessionId[sessionId];
        return;
      }

      insightsBySessionId[sessionId] = insights;
    },
    clearOrchestratorInsights: (state, action: PayloadAction<string>) => {
      const insightsBySessionId = ensureOrchestratorInsightsMap(state);
      delete insightsBySessionId[action.payload];
    },
    hydrateSessionMessages: (
      state,
      action: PayloadAction<{ sessionId: string; messages: Message[] }>,
    ) => {
      const { sessionId, messages } = action.payload;
      const remaining = state.messages.filter((message) => message.sessionId !== sessionId);
      const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
      state.messages = [...remaining, ...sorted];
    },
  },
});

export const {
  addMessage,
  deleteMessage,
  clearSessionMessages,
  updateMessageContent,
  setIsLoading,
  setOrchestratorInsights,
  clearOrchestratorInsights,
  hydrateSessionMessages,
} = chatSlice.actions;

export default chatSlice.reducer;