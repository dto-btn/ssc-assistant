import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import sessionsReducer from "../slices/sessionSlice";
import chatReducer from "../slices/chatSlice";
import { deriveSessionName, sendAssistantMessage } from "./assistantThunks";
import { completionService } from "../../services/completionService";
import {
  getOrchestratorInsights,
  resolveServersFromInsights,
} from "../../services/orchestratorService";

vi.mock("../../../util/token", () => ({
  isTokenExpired: vi.fn(() => false),
}));

vi.mock("../../services/completionService", () => ({
  completionService: {
    createCompletion: vi.fn(),
  },
}));

vi.mock("../../services/orchestratorService", () => ({
  getOrchestratorInsights: vi.fn(),
  resolveServersFromInsights: vi.fn(() => []),
}));

vi.mock("../../api/storage", () => ({
  extractFileText: vi.fn(),
  fetchFileDataUrl: vi.fn(),
}));

vi.mock("../../../i18n", () => ({
  default: { t: (key: string) => key },
}));

const createCompletionMock = vi.mocked(completionService.createCompletion);
const getOrchestratorInsightsMock = vi.mocked(getOrchestratorInsights);
const resolveServersFromInsightsMock = vi.mocked(resolveServersFromInsights);
const fetchMock = vi.fn();

const DEFAULT_COMPLETION_RESULT = {
  fullText: "",
  completed: true,
  provider: "azure-openai",
  citations: [],
};

const GROUNDING_PROMPT_FRAGMENT = "treat that material as the primary evidence for your answer";
const REWRITE_PROMPT_FRAGMENT = "You are revising an assistant answer using cited source excerpts returned from MCP tools";

const orchestratorServer = {
  server_label: "orchestrator-server",
  server_description: "Orchestrator MCP",
  server_url: "https://example.com/orchestrator/mcp",
};

const policyServer = {
  server_label: "policy-server",
  server_description: "Policy content MCP",
  server_url: "https://example.com/policy/mcp",
};

type MakeStoreOptions = {
  isNewChat: boolean;
  accessToken?: string | null;
  mcpServers?: Array<typeof orchestratorServer>;
};

const makeStore = ({
  isNewChat,
  accessToken = "valid-token",
  mcpServers = [],
}: MakeStoreOptions) => {
  const authReducer = (state = { accessToken }) => state;
  const toolsReducer = (state = { mcpServers }) => state;
  const modelsReducer = (state = { selectedModel: "" }) => state;

  return configureStore({
    reducer: {
      sessions: sessionsReducer,
      chat: chatReducer,
      auth: authReducer,
      tools: toolsReducer,
      models: modelsReducer,
    },
    preloadedState: {
      sessions: {
        sessions: [
          {
            id: "session-1",
            name: "Conversation 1",
            createdAt: Date.now(),
            isNewChat,
          },
        ],
        currentSessionId: "session-1",
      },
    } as any,
  });
};

const countGroundingMessages = (messages: Array<{ role: string; content?: unknown }>): number => {
  return messages.filter(
    (message) =>
      message.role === "system"
      && typeof message.content === "string"
      && message.content.includes(GROUNDING_PROMPT_FRAGMENT),
  ).length;
};

describe("deriveSessionName", () => {
  it("returns the first 5 words when they fit within 30 characters", () => {
    expect(deriveSessionName("What is the capital of France?")).toBe("What is the capital of");
  });

  it("applies the 30-character cap when 5 words exceed it", () => {
    const input = "superlongwordaaa superlongwordaaa superlongwordaaa";
    const result = deriveSessionName(input);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("returns all words when fewer than 5", () => {
    expect(deriveSessionName("Hello world")).toBe("Hello world");
  });

  it("trims leading and trailing whitespace before splitting", () => {
    expect(deriveSessionName("  hello world  ")).toBe("hello world");
  });

  it("returns an empty string for blank input", () => {
    expect(deriveSessionName("")).toBe("");
    expect(deriveSessionName("   ")).toBe("");
  });

  it("collapses internal whitespace correctly", () => {
    expect(deriveSessionName("one  two   three")).toBe("one two three");
  });

  it("caps output at 30 characters, protecting against long tokens", () => {
    const longUrl = "https://very-long-example.domain.com/some/path/to/resource";
    const result = deriveSessionName(longUrl);
    expect(result.length).toBeLessThanOrEqual(30);
  });

  it("handles a sentence where 5 words fit within 20 characters", () => {
    expect(deriveSessionName("a b c d e f g")).toBe("a b c d e");
  });
});

describe("sendAssistantMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    createCompletionMock.mockResolvedValue(DEFAULT_COMPLETION_RESULT);
    getOrchestratorInsightsMock.mockResolvedValue(null as any);
    resolveServersFromInsightsMock.mockReturnValue([]);
    fetchMock.mockResolvedValue({ ok: false } as any);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renames a new session from the first meaningful user message", async () => {
    const store = makeStore({ isNewChat: true });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What is the capital of France?",
      }) as any,
    );

    expect(store.getState().sessions.sessions[0].name).toBe("What is the capital of");
    expect(store.getState().sessions.sessions[0].isNewChat).toBe(false);
  });

  it("returns early when the access token is missing", async () => {
    const store = makeStore({ isNewChat: true, accessToken: null });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Hello there",
      }) as any,
    );

    expect(store.getState().sessions.sessions[0].name).toBe("Conversation 1");
    expect(store.getState().sessions.sessions[0].isNewChat).toBe(true);
    expect(createCompletionMock).not.toHaveBeenCalled();
  });

  it("prepends a generic grounding system message for MCP-backed runs", async () => {
    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    expect(request.messages[0]).toMatchObject({ role: "system" });
    expect(request.messages[0].content).toContain(GROUNDING_PROMPT_FRAGMENT);
    expect(countGroundingMessages(request.messages as Array<{ role: string; content?: unknown }>)).toBe(1);
  });

  it("orders the grounding system message before preflight routing context", async () => {
    getOrchestratorInsightsMock.mockResolvedValue({
      category: "policy",
      recommendations: [],
      source: "orchestrator",
      timestamp: new Date().toISOString(),
    } as any);
    resolveServersFromInsightsMock.mockReturnValue([policyServer as any]);
    fetchMock.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        recommendations: [{ category: "policy", mcp_server_id: "policy-server" }],
      }),
    } as any);

    const store = makeStore({
      isNewChat: false,
      mcpServers: [orchestratorServer, policyServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    expect(request.messages[0].content).toContain(GROUNDING_PROMPT_FRAGMENT);
    expect(request.messages[1]).toMatchObject({ role: "system" });
    expect(request.messages[1].content).toContain("Orchestrator preflight selected category 'policy'");
  });

  it("does not add the grounding prompt when no MCP servers are routed", async () => {
    const store = makeStore({ isNewChat: false, mcpServers: [] });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    expect(countGroundingMessages(request.messages as Array<{ role: string; content?: unknown }>)).toBe(0);
  });

  it("reuses exactly one grounding message when retrying without MCP tools", async () => {
    createCompletionMock
      .mockRejectedValueOnce(new Error("Tool failure"))
      .mockResolvedValueOnce(DEFAULT_COMPLETION_RESULT);

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(2);

    const firstRequest = createCompletionMock.mock.calls[0][0];
    const secondRequest = createCompletionMock.mock.calls[1][0];

    expect(countGroundingMessages(firstRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(1);
    expect(countGroundingMessages(secondRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(1);
    expect(firstRequest.servers).toHaveLength(1);
    expect(secondRequest.servers).toEqual([]);
  });

  it("rewrites MCP-backed answers against citation excerpts before storing the final response", async () => {
    createCompletionMock
      .mockResolvedValueOnce({
        fullText: "EPS stands for Enterprise Project System.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Project Management Operating Guide EN.pdf",
            url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
            content: "Page 71\nF.1 Enterprise Portfolio System (EPS) is SSC's system of record.",
            startIndex: 0,
            endIndex: 10,
          },
        ],
      })
      .mockResolvedValueOnce({
        fullText: "Enterprise Portfolio System (EPS) is SSC's system of record.",
        completed: true,
        provider: "azure-openai",
        citations: [],
      });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What is the purpose of the Enterprise Project System (EPS)?",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(2);

    const rewriteRequest = createCompletionMock.mock.calls[1][0];
    expect(rewriteRequest.servers).toEqual([]);
    expect(rewriteRequest.messages[0].content).toContain(REWRITE_PROMPT_FRAGMENT);
    expect(rewriteRequest.messages[1].content).toContain("Enterprise Portfolio System (EPS) is SSC's system of record");

    const assistantMessage = store.getState().chat.messages.find((message) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("Enterprise Portfolio System (EPS) is SSC's system of record.");
    expect(assistantMessage?.citations).toEqual([
      {
        title: "Project Management Operating Guide EN.pdf",
        url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
        content: "Page 71\nF.1 Enterprise Portfolio System (EPS) is SSC's system of record.",
      },
    ]);
  });

  it("skips the rewrite pass when citations do not include source excerpts", async () => {
    createCompletionMock.mockResolvedValue({
      fullText: "EPS is used for portfolio tracking.",
      completed: true,
      provider: "azure-openai",
      citations: [
        {
          title: "EPS Guide.pdf",
          url: "/pmcoe/en/eps-guide.pdf",
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What is EPS?",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(1);
    const assistantMessage = store.getState().chat.messages.find((message) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("EPS is used for portfolio tracking.");
  });
});