import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPersistableState,
  hasPersistableStateChanged,
  loadChatState,
  saveChatState,
  shouldPersistAction,
} from "./persistence";

/**
 * Verifies persistence migration keeps durable preferences and resets transient UI state.
 */
describe("playground persistence migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("hydrates sidebar collapse preference and resets transient mobile drawer state", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({
        chat: { messages: [], isLoadingBySessionId: {} },
        ui: { isSidebarCollapsed: true, isMobileSidebarOpen: true },
      })
    );

    const state = loadChatState() as {
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.ui.isSidebarCollapsed).toBe(true);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });

  it("resets persisted assistant response phases during hydration", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({
        chat: {
          messages: [],
          assistantResponsePhaseBySessionId: {
            s1: "streaming",
            s2: "drafting",
          },
        },
      })
    );

    const state = loadChatState() as {
      chat: { assistantResponsePhaseBySessionId: Record<string, unknown> };
    };

    expect(state.chat.assistantResponsePhaseBySessionId).toEqual({});
  });

  it("defaults ui state when missing in legacy payload", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({ chat: { messages: [] } })
    );

    const state = loadChatState() as {
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.ui.isSidebarCollapsed).toBe(false);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });

  it("returns undefined for malformed JSON payloads", () => {
    localStorage.setItem("playground_chat_state", "{bad-json");

    const state = loadChatState();

    expect(state).toBeUndefined();
  });

  it("migrates invalid legacy branches to safe defaults", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({
        chat: { messages: {}, isLoadingBySessionId: "yes" },
        ui: { isSidebarCollapsed: "no", isMobileSidebarOpen: true },
      })
    );

    const state = loadChatState() as {
      chat: { messages: unknown[]; isLoadingBySessionId: Record<string, boolean> };
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.chat.messages).toEqual([]);
    expect(state.chat.isLoadingBySessionId).toEqual({});
    expect(state.ui.isSidebarCollapsed).toBe(false);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });

  it("persists only durable slices and omits transient auth and toast state", () => {
    saveChatState({
      chat: { messages: [] },
      sessions: { sessions: [], currentSessionId: null },
      ui: { isSidebarCollapsed: true },
      auth: { accessToken: "secret" },
      toast: { message: "saved" },
    });

    expect(JSON.parse(localStorage.getItem("playground_chat_state") || "{}"))
      .toEqual({
        chat: { messages: [] },
        sessions: { sessions: [], currentSessionId: null },
        ui: { isSidebarCollapsed: true },
      });
  });

  it("does not persist assistant response phase", () => {
    saveChatState({
      chat: {
        messages: [],
        assistantResponsePhaseBySessionId: { s1: "streaming" },
      },
    });

    const persisted = JSON.parse(localStorage.getItem("playground_chat_state") || "{}");

    expect(persisted.chat).toEqual({ messages: [] });
  });

  it("logs once per consecutive sequence of failed saves", () => {
    const error = new DOMException("Quota exceeded", "QuotaExceededError");
    let failing = true;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      if (failing) throw error;
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const state = { chat: { messages: [] } };

    expect(saveChatState(state)).toBe("failed");
    expect(saveChatState(state)).toBe("failed");
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("Could not save playground conversations", error);

    failing = false;
    expect(saveChatState(state)).toBe("saved");
    failing = true;
    expect(saveChatState(state)).toBe("failed");
    expect(log).toHaveBeenCalledTimes(2);
    failing = false;
    expect(saveChatState(state)).toBe("saved");
  });

  it("retries a quota failure with shorter imported text and keeps other sessions", () => {
    const originalSetItem = Storage.prototype.setItem;
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage, key, value,
    ) {
      if (value.length > 30_000) throw new DOMException("Quota exceeded", "QuotaExceededError");
      originalSetItem.call(this, key, value);
    });
    const log = vi.spyOn(console, "error");
    const sessions = { sessions: [{ id: "imported", suggestionHandoffId: "handoff" }, { id: "other" }] };
    const imported = {
      id: "m1", sessionId: "imported", role: "assistant", timestamp: 1,
      content: "a".repeat(40_000), preserveFullContent: true,
      citations: [{ title: "Source", url: "https://example.com" }],
    };
    const other = { id: "m2", sessionId: "other", role: "user", timestamp: 2, content: "Keep me" };

    expect(saveChatState({ sessions, chat: { messages: [imported, other] } })).toBe("shortened");
    expect(write).toHaveBeenCalledTimes(2);
    expect(log).not.toHaveBeenCalled();
    expect(loadChatState()).toMatchObject({
      sessions,
      chat: { messages: [{ ...imported, content: "a".repeat(20_000) }, other] },
    });
    expect(imported.content).toHaveLength(40_000);
  });

  it.each([
    ["QuotaExceededError", 2],
    ["SecurityError", 1],
  ])("preserves the previous snapshot when a write ends in %s", (errorName, attempts) => {
    const state = { chat: { messages: [] } };
    expect(saveChatState(state)).toBe("saved");
    const before = localStorage.getItem("playground_chat_state");
    const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage write failed", errorName);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(saveChatState({
      chat: { messages: [{
        id: "m1", sessionId: "imported", role: "assistant", timestamp: 1,
        content: "a".repeat(30_000), preserveFullContent: true,
      }] },
    })).toBe("failed");
    expect(write).toHaveBeenCalledTimes(attempts);
    expect(log).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("playground_chat_state")).toBe(before);
  });

  it("applies the normal limit to unmarked messages in legacy imported sessions", () => {
    const content = "x".repeat(20_001);
    const message = {
      id: "m1",
      sessionId: "s1",
      role: "assistant",
      content,
      timestamp: 1,
    };
    saveChatState({
      sessions: { sessions: [{ id: "s1", suggestionHandoffId: "handoff" }] },
      chat: { messages: [message] },
    });

    expect(loadChatState()).toMatchObject({
      chat: { messages: [{ ...message, content: content.slice(0, 20_000) }] },
    });
  });

  it("detects when only transient slices changed so persistence can be skipped", () => {
    const previous = createPersistableState({
      chat: { messages: [] },
      sessions: { sessions: [], currentSessionId: null },
      ui: { isSidebarCollapsed: false },
    });

    const next = createPersistableState({
      chat: previous.chat,
      sessions: previous.sessions,
      ui: previous.ui,
      toast: { message: "transient" },
    });

    expect(hasPersistableStateChanged(previous, next)).toBe(false);
  });

  it("only schedules persistence for actions from persisted slices", () => {
    expect(shouldPersistAction("chat/addMessage")).toBe(true);
    expect(shouldPersistAction("ui/setSidebarCollapsed")).toBe(true);
    expect(shouldPersistAction("toast/addToast")).toBe(false);
    expect(shouldPersistAction(undefined)).toBe(false);
  });
});
