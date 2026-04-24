/**
 * Tests for auto-rename logic introduced in PR #812.
 *
 * Covers:
 *  1. deriveSessionName – pure-function edge cases
 *  2. sendAssistantMessage thunk – auto-rename branch fires on isNewChat === true
 *     and is skipped on subsequent messages.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { type UnknownAction } from "@reduxjs/toolkit";
import {
  deriveSessionName,
  sendAssistantMessage,
} from "./assistantThunks";
import { renameSession, setIsSessionNew } from "../slices/sessionSlice";
import type { RootState } from "..";

// ---------------------------------------------------------------------------
// Module mocks – stub out anything that makes real network calls or uses
// env vars that complicate the test environment.
// ---------------------------------------------------------------------------

vi.mock("./sessionManagementThunks", () => ({
  persistSessionRename: vi.fn(() => () => Promise.resolve()),
}));

vi.mock("../../../util/token", () => ({
  isTokenExpired: vi.fn(() => false),
}));

vi.mock("../../services/completionService", () => ({
  completionService: {
    createCompletion: vi.fn(async () => ({
      fullText: "stubbed response",
      completed: true,
      provider: "azure-openai",
      citations: [],
    })),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal RootState stub, merging optional overrides. */
function makeState(overrides: { isNewChat: boolean; accessToken?: string | null }): () => RootState {
  return () =>
    ({
      sessions: {
        sessions: [
          { id: "session-1", name: "Conversation 1", createdAt: Date.now(), isNewChat: overrides.isNewChat },
        ],
        currentSessionId: "session-1",
      },
      auth: { accessToken: overrides.accessToken ?? null },
      tools: { mcpServers: [] },
      chat: { messages: [], isLoading: false, orchestratorInsightsBySessionId: {} },
      models: { selectedModel: "" },
    }) as unknown as RootState;
}

/** Collects plain Redux actions dispatched by a thunk. */
function makeDispatch() {
  const dispatched: UnknownAction[] = [];
  const dispatch = vi.fn((action: unknown) => {
    if (typeof action === "function") {
      return (action as (d: typeof dispatch, g: () => RootState) => unknown)(dispatch, () => ({}) as RootState);
    }
    dispatched.push(action as UnknownAction);
    return action;
  });
  return { dispatch, dispatched };
}

// ---------------------------------------------------------------------------
// 1. deriveSessionName – unit tests
// ---------------------------------------------------------------------------

describe("deriveSessionName", () => {
  it("returns the first 5 words when they fit within 30 characters", () => {
    // "What is the capital of" = 22 chars — under the 30-char cap
    expect(deriveSessionName("What is the capital of France?")).toBe("What is the capital of");
  });

  it("applies the 30-character cap when 5 words exceed it", () => {
    // "Superlongword superlongword sup" = 30 chars exactly after slicing
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
    // "a b c d e" = 9 chars — well inside the limit
    expect(deriveSessionName("a b c d e f g")).toBe("a b c d e");
  });
});

// ---------------------------------------------------------------------------
// 2. sendAssistantMessage – auto-rename branch
// ---------------------------------------------------------------------------

describe("sendAssistantMessage auto-rename", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("dispatches renameSession with derived name when isNewChat is true and token is valid", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: true, accessToken: "valid-token" });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "What is the capital of France?",
    })(dispatch, getState, undefined);

    const renameAction = dispatched.find((a) => a.type === renameSession.type);
    expect(renameAction).toBeDefined();
    expect(renameAction?.payload).toEqual({
      id: "session-1",
      name: "What is the capital of",
    });
  });

  it("dispatches setIsSessionNew(false) when isNewChat is true and token is valid", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: true, accessToken: "valid-token" });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "Hello there",
    })(dispatch, getState, undefined);

    const newChatAction = dispatched.find((a) => a.type === setIsSessionNew.type);
    expect(newChatAction).toBeDefined();
    expect(newChatAction?.payload).toEqual({ id: "session-1", isNew: false });
  });

  it("does not dispatch renameSession or setIsSessionNew when token is missing", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: true, accessToken: null });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "Hello there",
    })(dispatch, getState, undefined);

    const renameAction = dispatched.find((a) => a.type === renameSession.type);
    const newChatAction = dispatched.find((a) => a.type === setIsSessionNew.type);

    expect(renameAction).toBeUndefined();
    expect(newChatAction).toBeUndefined();
  });

  it("does not dispatch renameSession when isNewChat is false", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: false, accessToken: "valid-token" });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "What is the capital of France?",
    })(dispatch, getState, undefined);

    const renameAction = dispatched.find((a) => a.type === renameSession.type);
    expect(renameAction).toBeUndefined();
  });

  it("does not dispatch renameSession or setIsSessionNew when content is empty", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: true, accessToken: "valid-token" });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "   ",
    })(dispatch, getState, undefined);

    const renameAction = dispatched.find((a) => a.type === renameSession.type);
    const newChatAction = dispatched.find((a) => a.type === setIsSessionNew.type);

    expect(renameAction).toBeUndefined();
    expect(newChatAction).toBeUndefined();
  });

  it("dispatches setIsSessionNew(false) but not renameSession when only attachments are present", async () => {
    const { dispatch, dispatched } = makeDispatch();
    const getState = makeState({ isNewChat: true, accessToken: "valid-token" });

    await sendAssistantMessage({
      sessionId: "session-1",
      content: "   ",
      attachments: [{ id: '1', fileName: 'test.pdf', fileType: 'application/pdf', status: 'ready' } as any]
    })(dispatch, getState, undefined);

    const renameAction = dispatched.find((a) => a.type === renameSession.type);
    const newChatAction = dispatched.find((a) => a.type === setIsSessionNew.type);

    expect(renameAction).toBeUndefined();
    expect(newChatAction).toBeDefined();
    expect(newChatAction?.payload).toEqual({ id: "session-1", isNew: false });
  });
});
