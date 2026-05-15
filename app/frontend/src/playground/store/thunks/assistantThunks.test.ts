import { waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import sessionsReducer from "../slices/sessionSlice";
import chatReducer from "../slices/chatSlice";
import { addMessage } from "../slices/chatSlice";
import {
  deriveSessionName,
  hasRequiredEpsLegacyCitations,
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  sendAssistantMessage,
  stopAssistantMessage,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
} from "./assistantThunks";
import { completionService, type CompletionResult } from "../../services/completionService";
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
const BITS_FILTER_PROMPT_FRAGMENT = "apply all explicit user constraints as retrieval filters";
const CITATION_HARVEST_PROMPT_FRAGMENT = "You are gathering authoritative source material for a user request.";
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

const bitsServer = {
  server_label: "bits_mcp",
  server_description: "Business request and change-request workflows",
  server_url: "https://example.com/bits/mcp",
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
    } as any,
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

const hasPreflightRoutingMessage = (messages: Array<{ role: string; content?: unknown }>): boolean => {
  return messages.some(
    (message) =>
      message.role === "system"
      && typeof message.content === "string"
      && message.content.includes("Orchestrator preflight routing summary"),
  );
};

const seedSessionMessages = (
  store: ReturnType<typeof makeStore>,
  count: number,
): void => {
  for (let index = 0; index < count; index += 1) {
    store.dispatch(
      addMessage({
        sessionId: "session-1",
        role: index % 2 === 0 ? "user" : "assistant",
        content: `Seed message ${index + 1}`,
      })
    );
  }
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

describe("citation enrichment guards", () => {
  it("detects EPS prompts and missing canonical EPS citations", () => {
    expect(isLikelyEpsCitationQuery("What is the purpose of EPS?")).toBe(true);
    expect(
      shouldEnrichEpsCitations("What is the purpose of EPS?", [
        {
          title: "Project Management Operating Guide EN.pdf",
          url: "local-citation://eps-guide-xyz",
        },
      ])
    ).toBe(true);
  });

  it("continues EPS enrichment when only the canonical corporate sources are present", () => {
    const citations = [
      {
        title: "Enterprise Portfolio System",
        url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
      },
      {
        title: "Enterprise Portfolio system training",
        url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
      },
    ];

    expect(hasRequiredEpsLegacyCitations(citations)).toBe(true);
    expect(shouldEnrichEpsCitations("What is the purpose of EPS?", citations)).toBe(true);
  });

  it("continues EPS enrichment when only one concrete excerpt-bearing source is present", () => {
    expect(
      shouldEnrichEpsCitations("What is the purpose of EPS?", [
        {
          title: "Project Management Operating Guide EN.pdf",
          url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
          content: "Page 71\nF.1 Enterprise Portfolio System (EPS) is SSC's system of record.",
        },
      ])
    ).toBe(true);
  });

  it("stops EPS enrichment only when multiple distinct concrete sources are already present", () => {
    expect(
      shouldEnrichEpsCitations("How does EPS fit within the project management lifecycle?", [
        {
          title: "Enterprise Portfolio System",
          url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
          content: "EPS is SSC's standard tool to manage projects.",
        },
        {
          title: "Enterprise Portfolio system training",
          url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
          content: "EPS supports project reporting and schedule updates.",
        },
        {
          title: "Project Management Operating Guide EN.pdf",
          url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
          content: "Page 71\nEPS is SSC's system of record across the project lifecycle.",
        },
      ])
    ).toBe(false);
  });

  it("detects PMCOE prompts and requests enrichment when citations are synthetic or sparse", () => {
    expect(isLikelyPmcoeCitationQuery("How do I track the progress of my project through the gates?")).toBe(true);
    expect(
      shouldEnrichPmcoeCitations("How do I track the progress of my project through the gates?", [
        {
          title: "Project Management Operating Guide EN.pdf",
          url: "local-citation://project-management-operating-guide-en-pdf-abc123",
        },
      ])
    ).toBe(true);
  });

  it("requests PMCOE enrichment when concrete sources do not include excerpts", () => {
    expect(
      shouldEnrichPmcoeCitations("How do I track the progress of my project through the gates?", [
        {
          title: "Project Management Operating Guide EN.pdf",
          url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
        },
        {
          title: "Gating quick reference.pdf",
          url: "/pmcoe-sept-2025/en/Gating quick reference.pdf",
        },
      ])
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. sendAssistantMessage – auto-rename branch
// ---------------------------------------------------------------------------

describe("sendAssistantMessage auto-rename", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    createCompletionMock.mockResolvedValue(DEFAULT_COMPLETION_RESULT);
    getOrchestratorInsightsMock.mockResolvedValue(null as any);
    resolveServersFromInsightsMock.mockReturnValue([]);
    fetchMock.mockResolvedValue({ ok: false } as any);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
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

  it("injects the BITS filter-enforcement system prompt when a bits server is routed", async () => {
    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Give me a pie chart of BA OPI that worked on BRs for March for ESDC high priority only.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    const systemMessages = (request.messages as Array<{ role: string; content?: unknown }>).filter(
      (message) => message.role === "system" && typeof message.content === "string"
    );

    expect(
      systemMessages.some((message) =>
        String(message.content).includes(BITS_FILTER_PROMPT_FRAGMENT)
      )
    ).toBe(true);
  });

  it("injects inferred BITS query filters from the user prompt", async () => {
    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Give me a pie chart of BA OPI that worked on BRs for the month of March for the client ESDC for brs of high priority only.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    const systemMessages = (request.messages as Array<{ role: string; content?: unknown }>)
      .filter((message) => message.role === "system" && typeof message.content === "string")
      .map((message) => String(message.content));

    expect(systemMessages.some((content) => content.includes("Date Submited (SUBMIT_DATE) >="))).toBe(true);
    expect(systemMessages.some((content) => content.includes("Date Submited (SUBMIT_DATE) <="))).toBe(true);
    expect(systemMessages.some((content) => content.includes("Client Name candidate: ESDC"))).toBe(true);
    expect(systemMessages.some((content) => content.includes("Priority (PRIORITY_EN) = High"))).toBe(true);
  });

  it("requires tool usage for BITS-routed completion runs", async () => {
    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Show BA OPI distribution for ESDC high priority BRs in March",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    expect(request.toolChoice).toBe("required");
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
    expect(request.messages[1].content).toContain("Orchestrator preflight routing summary");
    expect(request.messages[1].content).toContain("categories='policy'");
    expect(request.messages[1].content).toContain("servers='policy-server'");
  });

  it("caps the outbound MCP-backed completion payload at 10 messages", async () => {
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
    seedSessionMessages(store, 12);

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    const request = createCompletionMock.mock.calls[0][0];
    expect(request.messages).toHaveLength(10);
    expect(request.messages[0]).toMatchObject({ role: "system" });
    expect(request.messages[1]).toMatchObject({ role: "system" });
    expect(request.messages[2]).toMatchObject({ role: "system" });
  });

  it("caps the outbound fallback completion payload at 10 messages after retrying without tools", async () => {
    createCompletionMock
      .mockRejectedValueOnce(new Error("Tool failure"))
      .mockResolvedValueOnce(DEFAULT_COMPLETION_RESULT as any);

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });
    seedSessionMessages(store, 12);

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(2);
    const retryRequest = createCompletionMock.mock.calls[1][0];
    expect(retryRequest.messages).toHaveLength(10);
    expect(retryRequest.messages[0]).toMatchObject({ role: "system" });
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

  it("removes MCP-specific system context when retrying without MCP tools", async () => {
    createCompletionMock
      .mockRejectedValueOnce(new Error("Tool failure"))
      .mockResolvedValueOnce(DEFAULT_COMPLETION_RESULT);
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

    expect(createCompletionMock).toHaveBeenCalledTimes(2);

    const firstRequest = createCompletionMock.mock.calls[0][0];
    const secondRequest = createCompletionMock.mock.calls[1][0];

    expect(countGroundingMessages(firstRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(1);
    expect(hasPreflightRoutingMessage(firstRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(true);
    expect(countGroundingMessages(secondRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(0);
    expect(hasPreflightRoutingMessage(secondRequest.messages as Array<{ role: string; content?: unknown }>)).toBe(false);
    expect(firstRequest.servers).toHaveLength(1);
    expect(secondRequest.servers).toEqual([]);
  });

  it("does not re-enter MCP citation harvest after a no-tools retry succeeds", async () => {
    createCompletionMock
      .mockRejectedValueOnce(new Error("Tool failure"))
      .mockResolvedValueOnce({
        fullText: "EPS is used for portfolio tracking.",
        completed: true,
        provider: "azure-openai",
        citations: [],
      })
      .mockResolvedValueOnce({
        fullText: "EPS is used for portfolio tracking.",
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
        content: "What is EPS?",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(3);

    const retryRequest = createCompletionMock.mock.calls[1][0];
    const postRetryRequest = createCompletionMock.mock.calls[2][0];

    expect(retryRequest.servers).toEqual([]);
    expect(postRetryRequest.servers).toEqual([]);
    expect(postRetryRequest.toolChoice).toBeUndefined();
    expect(postRetryRequest.messages[0].content).toContain(REWRITE_PROMPT_FRAGMENT);
    expect(
      createCompletionMock.mock.calls.some(([request]) => request.toolChoice === "required")
    ).toBe(false);

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("EPS is used for portfolio tracking.");
  });

  it("keeps streamed draft text hidden while the answer is still drafting", async () => {
    let releaseCompletion: (() => void) | undefined;

    createCompletionMock.mockImplementationOnce(async (_request, callbacks) => {
      callbacks?.onChunk?.("Hidden ");
      callbacks?.onChunk?.("draft");

      await new Promise<void>((resolve) => {
        releaseCompletion = resolve;
      });

      return {
        fullText: "Hidden draft",
        completed: true,
        provider: "azure-openai",
        citations: [],
      };
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    const dispatchPromise = store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    await waitFor(() => {
      expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBe("drafting");
    });

    const draftingMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(draftingMessage?.content).toBe("");

    releaseCompletion?.();
    await dispatchPromise;

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("Hidden draft");
  });

  it("reveals the buffered partial answer with a stopped marker when aborted", async () => {
    createCompletionMock.mockImplementationOnce((request, callbacks) => {
      callbacks?.onChunk?.("Partial answer");

      return new Promise<CompletionResult>((_resolve, reject) => {
        request.signal?.addEventListener(
          "abort",
          () => reject(new Error("aborted")),
          { once: true },
        );
      });
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    const dispatchPromise = store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Summarize the policy guidance.",
      }) as any,
    );

    await waitFor(() => {
      expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBe("drafting");
    });

    expect(
      store.getState().chat.messages.find((message: any) => message.role === "assistant")?.content,
    ).toBe("");

    stopAssistantMessage("session-1");
    await dispatchPromise;

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("Partial answer\n\n*playground:assistant.stopped*");
    expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBe("idle");
  });

  it("stops the local reveal phase after drafting has completed", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia,
    );

    createCompletionMock.mockResolvedValueOnce({
      fullText: "This answer keeps revealing after drafting completes.",
      completed: true,
      provider: "azure-openai",
      citations: [],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [policyServer],
    });

    try {
      const flushMicrotasks = async (iterations = 8): Promise<void> => {
        for (let index = 0; index < iterations; index += 1) {
          await Promise.resolve();
        }
      };

      const dispatchPromise = store.dispatch(
        sendAssistantMessage({
          sessionId: "session-1",
          content: "Summarize the policy guidance.",
        }) as any,
      );

      await flushMicrotasks();

      expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBe("streaming");

      await vi.advanceTimersByTimeAsync(50);

      const partiallyRevealedContent = store
        .getState()
        .chat.messages.find((message: any) => message.role === "assistant")?.content;

      expect(partiallyRevealedContent).toBeTruthy();
      expect(partiallyRevealedContent).not.toBe("This answer keeps revealing after drafting completes.");

      stopAssistantMessage("session-1");

      await vi.runAllTimersAsync();
      await dispatchPromise;

      const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
      expect(assistantMessage?.content).toBe(`${partiallyRevealedContent}\n\n*playground:assistant.stopped*`);
      expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBe("idle");
    } finally {
      vi.useRealTimers();
    }
  }, 15000);

  it("rewrites non-EPS MCP-backed answers against citation excerpts before storing the final response", async () => {
    createCompletionMock
      .mockResolvedValueOnce({
        fullText: "The policy requires quarterly reporting.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Policy Guide.pdf",
            url: "/policy/Policy Guide.pdf",
            content: "Section 4\nQuarterly reporting is mandatory for active initiatives.",
            startIndex: 0,
            endIndex: 10,
          },
        ],
      })
      .mockResolvedValueOnce({
        fullText: "Quarterly reporting is mandatory for active initiatives.",
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
        content: "Summarize the policy guidance.",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(2);

    const rewriteRequest = createCompletionMock.mock.calls[1][0];
    expect(rewriteRequest.servers).toEqual([]);
    expect(rewriteRequest.messages[0].content).toContain(REWRITE_PROMPT_FRAGMENT);
    expect(rewriteRequest.messages[1].content).toContain("Quarterly reporting is mandatory for active initiatives.");

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("Quarterly reporting is mandatory for active initiatives.");
    expect(assistantMessage?.citations).toEqual([
      {
        title: "Policy Guide.pdf",
        url: "/policy/Policy Guide.pdf",
        content: "Section 4\nQuarterly reporting is mandatory for active initiatives.",
      },
    ]);
  });

  it("falls back to canonical EPS citations when harvested excerpts are still missing", async () => {
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

    expect(createCompletionMock).toHaveBeenCalledTimes(3);
    const citationHarvestRequest = createCompletionMock.mock.calls[1][0];
    expect(citationHarvestRequest.toolChoice).toBe("required");
    expect(citationHarvestRequest.servers).toHaveLength(1);
    expect(citationHarvestRequest.messages[0].content).toContain(CITATION_HARVEST_PROMPT_FRAGMENT);

    const rewriteRequest = createCompletionMock.mock.calls[2][0];
    expect(rewriteRequest.servers).toEqual([]);
    expect(rewriteRequest.messages[0].content).toContain(REWRITE_PROMPT_FRAGMENT);

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("EPS is used for portfolio tracking.");
  });

  it("rewrites the stored answer when standalone citation harvest adds source excerpts", async () => {
    createCompletionMock
      .mockResolvedValueOnce({
        fullText: "EPS stands for Enterprise Project System.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Project Management Operating Guide EN.pdf",
            url: "local-citation://project-management-operating-guide-en-pdf-abc123",
          },
        ],
      })
      .mockResolvedValueOnce({
        fullText: "Enterprise Portfolio System (EPS) is SSC's system of record.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Enterprise Portfolio System",
            url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
            content: "The Enterprise Portfolio System (EPS) is SSC's system of record.",
          },
          {
            title: "Enterprise portfolio system training",
            url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
            content: "EPS is SSC's standard tool to manage projects and project reporting.",
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

    expect(createCompletionMock).toHaveBeenCalledTimes(3);

    const citationHarvestRequest = createCompletionMock.mock.calls[1][0];
    expect(citationHarvestRequest.toolChoice).toBe("required");
    expect(citationHarvestRequest.servers).toHaveLength(1);
    expect(citationHarvestRequest.messages[0].content).toContain(CITATION_HARVEST_PROMPT_FRAGMENT);

    const rewriteRequest = createCompletionMock.mock.calls[2][0];
    expect(rewriteRequest.servers).toEqual([]);
    expect(rewriteRequest.messages[0].content).toContain(REWRITE_PROMPT_FRAGMENT);
    expect(rewriteRequest.messages[1].content).toContain("Enterprise Portfolio System (EPS) is SSC's system of record");
    expect(rewriteRequest.messages[1].content).toContain("EPS is SSC's standard tool to manage projects and project reporting.");

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("Enterprise Portfolio System (EPS) is SSC's system of record.");
    expect(assistantMessage?.citations).toEqual([
      {
        title: "Enterprise Portfolio System",
        url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
        content: "The Enterprise Portfolio System (EPS) is SSC's system of record.",
      },
      {
        title: "Enterprise portfolio system training",
        url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
        content: "EPS is SSC's standard tool to manage projects and project reporting.",
      },
    ]);
  });

  it("preserves multiple excerpts from the same harvested PMCOE source during rewrite", async () => {
    createCompletionMock
      .mockResolvedValueOnce({
        fullText: "Follow the operating guide.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Project Management Operating Guide EN.pdf",
            url: "local-citation://project-management-operating-guide-en-pdf-abc123",
          },
        ],
      })
      .mockResolvedValueOnce({
        fullText: "Follow the operating guide.",
        completed: true,
        provider: "azure-openai",
        citations: [
          {
            title: "Project Management Operating Guide EN.pdf",
            url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
            content: "Page 10\nGate reviews track readiness, risks, and required approvals.",
          },
          {
            title: "Project Management Operating Guide EN.pdf",
            url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
            content: "Page 11\nProject teams should keep schedule, cost, and artefact updates current before each gate.",
          },
        ],
      })
      .mockResolvedValueOnce({
        fullText: "Track readiness, approvals, and project updates through each gate.",
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
        content: "How do I track the progress of my project through the gates?",
      }) as any,
    );

    expect(createCompletionMock).toHaveBeenCalledTimes(3);

    const rewriteRequest = createCompletionMock.mock.calls[2][0];
    expect(rewriteRequest.messages[1].content).toContain("Gate reviews track readiness, risks, and required approvals.");
    expect(rewriteRequest.messages[1].content).toContain("Project teams should keep schedule, cost, and artefact updates current before each gate.");

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.citations).toEqual([
      {
        title: "Project Management Operating Guide EN.pdf",
        url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
        content: "Page 10\nGate reviews track readiness, risks, and required approvals.",
      },
      {
        title: "Project Management Operating Guide EN.pdf",
        url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
        content: "Page 11\nProject teams should keep schedule, cost, and artefact updates current before each gate.",
      },
    ]);
  });

  it("extracts BR rows from get_br_page results payloads", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "Found BR results.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "get_br_page",
          output: JSON.stringify({
            results: [
              {
                BR_NMBR: "BR-1001",
                BR_SHORT_TITLE: "Identity sync issue",
                BITS_STATUS_EN: "Open",
              },
              {
                BR_NMBR: "BR-1002",
                BR_SHORT_TITLE: "Network access request",
                BITS_STATUS_EN: "Closed",
              },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Find BRs for the client PSPC.",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.brArtifacts?.brData).toHaveLength(2);
    expect(assistantMessage?.brArtifacts?.brData?.[0]).toMatchObject({
      BR_NMBR: "BR-1001",
      BR_SHORT_TITLE: "Identity sync issue",
    });
  });

  it("merges metadata from search output with rows from subsequent get_br_page output", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "Found BR results.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "search_business_requests",
          output: JSON.stringify({
            metadata: {
              results: 750,
              total_rows: 1310,
            },
            brquery: {
              RPT_GC_ORG_NAME_EN: "Public Services and Procurement Canada",
            },
            brselect: {
              fields: ["BR_NMBR", "BR_SHORT_TITLE"],
            },
          }),
        },
        {
          toolName: "get_br_page",
          output: JSON.stringify({
            results: [
              {
                BR_NMBR: "BR-2001",
                BR_SHORT_TITLE: "Migrate legacy service",
                SUBMIT_DATE: "2026-04-10",
              },
              {
                BR_NMBR: "BR-2002",
                BR_SHORT_TITLE: "Upgrade firewall policy",
                SUBMIT_DATE: "2026-04-12",
              },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Find BRs submitted in the last 3 weeks for PSPC.",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.brArtifacts?.brData).toHaveLength(2);
    expect(assistantMessage?.brArtifacts?.brMetadata).toMatchObject({
      results: 750,
      total_rows: 1310,
    });
    expect(assistantMessage?.brArtifacts?.brQuery).toMatchObject({
      RPT_GC_ORG_NAME_EN: "Public Services and Procurement Canada",
    });
    expect(assistantMessage?.brArtifacts?.brSelectFields?.fields).toEqual(["BR_NMBR", "BR_SHORT_TITLE"]);
  });

  it("ignores non-BR results arrays", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "Found results.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "get_br_page",
          output: JSON.stringify({
            results: [
              { foo: "bar" },
              { hello: "world" },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "Find BRs.",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.brArtifacts).toBeUndefined();
  });

  it("ignores BITS field-definition results that are not BR rows", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "You can ask about status, timelines, and owners.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "valid_search_fields",
          output: JSON.stringify({
            results: [
              { BR_NMBR: "Business Request Number" },
              { SUBMIT_DATE: "Date submitted" },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What kind of questions can I ask about Business Requests (BR)?",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toContain("status");
    expect(assistantMessage?.brArtifacts).toBeUndefined();
  });

  it("does not attach BR artifacts from valid_search_fields even with BR-like keys", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "You can ask by status, date range, client, or priority.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "valid_search_fields",
          output: JSON.stringify({
            results: [
              {
                BR_NMBR: "Business Request Number",
                BR_SHORT_TITLE: "Title",
                BITS_STATUS_EN: "Status",
              },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What kind of questions can I ask about Business Requests (BR)?",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toContain("status");
    expect(assistantMessage?.brArtifacts).toBeUndefined();
  });

  it("does not attach BR artifacts for BR guidance prompts even when rows are returned", async () => {
    createCompletionMock.mockResolvedValueOnce({
      fullText: "You can ask about status, timelines, priorities, and client-specific requests.",
      completed: true,
      provider: "azure-openai",
      citations: [],
      mcpToolOutputs: [
        {
          toolName: "search_business_requests",
          output: JSON.stringify({
            results: [
              {
                BR_NMBR: "BR-3001",
                BR_SHORT_TITLE: "Sample BR one",
                BITS_STATUS_EN: "Open",
              },
              {
                BR_NMBR: "BR-3002",
                BR_SHORT_TITLE: "Sample BR two",
                BITS_STATUS_EN: "Closed",
              },
            ],
          }),
        },
      ],
    });

    const store = makeStore({
      isNewChat: false,
      mcpServers: [bitsServer],
    });

    await store.dispatch(
      sendAssistantMessage({
        sessionId: "session-1",
        content: "What kind of questions can I ask about Business Requests (BR)?",
      }) as any,
    );

    const assistantMessage = store.getState().chat.messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toContain("status");
    expect(assistantMessage?.brArtifacts).toBeUndefined();
  });
});