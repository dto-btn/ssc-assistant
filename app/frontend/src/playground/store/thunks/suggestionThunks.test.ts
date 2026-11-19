import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { rootReducer } from "..";
import { ensureCurrentSession, importSuggestion, restoreSuggestionSession } from "./suggestionThunks";
import { addSession } from "../slices/sessionSlice";
import { addMessage } from "../slices/chatSlice";
import { loadChatState, saveChatState } from "../persistence";
import type { SuggestionContextSuccess } from "../../../api/suggestionContext.models";
import i18n from "../../../i18n";

const context: SuggestionContextSuccess = {
  success: true,
  language: "fr",
  original_query: "Quelle est la question?",
  content: "Voici la réponse [doc1].",
  timestamp: "2026-11-09T12:00:00.000Z",
  requester: "mysscplus",
  citations: [{ title: "Source", url: "https://example.com/source" }],
};

describe("importSuggestion", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("creates a new selected, titled conversation without reusing drafts", () => {
    const store = configureStore({ reducer: rootReducer });
    store.dispatch(addSession({
      id: "existing-draft",
      name: "Draft",
      createdAt: 1,
      isNewChat: true,
    }));
    const sessionId = store.dispatch(importSuggestion({ handoffId: "first", context }));
    const state = store.getState();
    expect(state.sessions.sessions).toHaveLength(2);
    expect(state.sessions.currentSessionId).toBe(sessionId);
    expect(state.sessions.sessions[1]).toMatchObject({
      name: context.original_query,
      isNewChat: false,
      language: "fr",
      suggestionHandoffId: "first",
    });

    expect(state.chat.messages).toMatchObject([
      { sessionId, role: "user", content: context.original_query },
      {
        sessionId,
        role: "assistant",
        content: context.content,
        language: "fr",
        citations: context.citations,
        showAllCitations: true,
      },
    ]);
    expect(loadChatState()).toMatchObject({
      sessions: state.sessions,
      chat: { messages: state.chat.messages },
    });
  });

  it("imports a hand-off once, but allows separate visits with the same question", () => {
    const store = configureStore({ reducer: rootReducer });
    const first = store.dispatch(importSuggestion({ handoffId: "first", context }));
    expect(store.dispatch(importSuggestion({ handoffId: "first", context }))).toBe(first);
    expect(store.getState().chat.messages).toHaveLength(2);
    const second = store.dispatch(importSuggestion({ handoffId: "second", context }));
    expect(second).not.toBe(first);
    expect(store.getState().sessions.sessions).toHaveLength(2);
    expect(store.getState().chat.messages).toHaveLength(4);
  });

  it.each([
    { query: "q".repeat(80), name: "q".repeat(80) },
    { query: "q".repeat(81), name: `${"q".repeat(79)}…` },
    { query: `${"q".repeat(77)}  rest`, name: `${"q".repeat(77)}…` },
    { query: `${"q".repeat(78)}😀rest`, name: `${"q".repeat(78)}…` },
  ])("limits the session name while keeping the full question", ({ query, name }) => {
    const store = configureStore({ reducer: rootReducer });
    const sessionId = store.dispatch(importSuggestion({
      handoffId: "long-name",
      context: { ...context, original_query: query },
    }));

    expect(store.getState().sessions.sessions[0].name).toBe(name);
    expect(loadChatState()).toMatchObject({
      sessions: { sessions: [{ id: sessionId, name }] },
      chat: { messages: [
        { sessionId, role: "user", content: query },
        { sessionId, role: "assistant", content: context.content },
      ] },
    });
  });

  it("surfaces persistence failures in the interface language", () => {
    const store = configureStore({ reducer: rootReducer });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    store.dispatch(importSuggestion({ handoffId: "first", context }));
    expect(store.getState().toast.toasts[0]).toMatchObject({
      severity: "error",
      message: i18n.t("playground:suggestion.errors.save"),
    });
    expect(store.getState().chat.messages).toHaveLength(2);
  });

  it("preserves complete imported answers beyond the normal persistence truncation limit", () => {
    const store = configureStore({ reducer: rootReducer });
    const longContext = {
      ...context,
      original_query: "q".repeat(20_001),
      content: "a".repeat(25_000),
    };
    const sessionId = store.dispatch(importSuggestion({ handoffId: "long", context: longContext }));
    store.dispatch(addMessage({ sessionId, role: "user", content: "q".repeat(20_001) }));
    store.dispatch(addMessage({ sessionId, role: "assistant", content: "a".repeat(25_000) }));
    expect(saveChatState(store.getState())).toBe(true);
    expect(loadChatState()).toMatchObject({
      chat: { messages: [
        { content: longContext.original_query, preserveFullContent: true },
        { content: longContext.content, citations: context.citations, preserveFullContent: true },
        { content: "q".repeat(20_000) },
        { content: "a".repeat(20_000) },
      ] },
    });
  });

  describe("suggestion session selection", () => {
    it("restores an existing session and returns its language", () => {
      const store = configureStore({ reducer: rootReducer });
      store.dispatch(addSession({
        id: "imported", name: "Imported", createdAt: 1, isNewChat: false, language: "fr",
      }));
      store.dispatch(addSession({ id: "other", name: "Other", createdAt: 2, isNewChat: false }));

      expect(store.dispatch(restoreSuggestionSession("imported"))).toBe("fr");
      expect(store.getState().sessions.currentSessionId).toBe("imported");
      expect(store.getState().sessions.sessions).toHaveLength(2);
    });

    it("reuses a draft when the restored session is missing", () => {
      const store = configureStore({ reducer: rootReducer });
      store.dispatch(addSession({ id: "draft", name: "Draft", createdAt: 1, isNewChat: true }));
      store.dispatch(addSession({ id: "other", name: "Other", createdAt: 2, isNewChat: false }));

      expect(store.dispatch(restoreSuggestionSession("missing"))).toBeUndefined();
      expect(store.getState().sessions.currentSessionId).toBe("draft");
      expect(store.getState().sessions.sessions).toHaveLength(2);
    });

    it("keeps a restored session without a saved language", () => {
      const store = configureStore({ reducer: rootReducer });
      store.dispatch(addSession({ id: "existing", name: "Existing", createdAt: 1, isNewChat: false }));

      expect(store.dispatch(restoreSuggestionSession("existing"))).toBeUndefined();
      expect(store.getState().sessions.currentSessionId).toBe("existing");
      expect(store.getState().sessions.sessions).toHaveLength(1);
    });

    it("starts a draft when no restored session was specified", () => {
      const store = configureStore({ reducer: rootReducer });
      expect(store.dispatch(restoreSuggestionSession(undefined))).toBeUndefined();
      expect(store.getState().sessions.sessions).toHaveLength(1);
      expect(store.getState().sessions.sessions[0].isNewChat).toBe(true);
    });

    it("creates a draft when no session is current", () => {
      const store = configureStore({ reducer: rootReducer });
      store.dispatch(ensureCurrentSession());

      expect(store.getState().sessions.sessions).toHaveLength(1);
      expect(store.getState().sessions.sessions[0]).toMatchObject({
        id: store.getState().sessions.currentSessionId,
        isNewChat: true,
      });
    });

    it("keeps the current session on a failed hand-off", () => {
      const store = configureStore({ reducer: rootReducer });
      store.dispatch(addSession({ id: "existing", name: "Existing", createdAt: 1, isNewChat: false }));
      store.dispatch(ensureCurrentSession());

      expect(store.getState().sessions.currentSessionId).toBe("existing");
      expect(store.getState().sessions.sessions).toHaveLength(1);
    });
  });
});
