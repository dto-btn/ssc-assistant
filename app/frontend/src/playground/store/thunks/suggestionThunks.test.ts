import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { rootReducer } from "..";
import { importSuggestion } from "./suggestionThunks";
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

  it("surfaces persistence failures in the answer's language", () => {
    const store = configureStore({ reducer: rootReducer });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    store.dispatch(importSuggestion({ handoffId: "first", context }));
    expect(store.getState().toast.toasts[0]).toMatchObject({
      severity: "error",
      message: i18n.t("playground:suggestion.errors.save", { lng: "fr" }),
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
    expect(saveChatState(store.getState())).toBe("saved");
    expect(loadChatState()).toMatchObject({
      chat: { messages: [
        { content: longContext.original_query, preserveFullContent: true },
        { content: longContext.content, citations: context.citations, preserveFullContent: true },
        { content: "q".repeat(20_000) },
        { content: "a".repeat(20_000) },
      ] },
    });
  });

  it("caps oversized imports only in the saved copy and warns about the truncation", () => {
    const store = configureStore({ reducer: rootReducer });
    const original_query = "q".repeat(100_001);
    const content = "a".repeat(100_001);
    store.dispatch(importSuggestion({ handoffId: "long", context: { ...context, original_query, content } }));

    expect(store.getState().chat.messages.map((message) => message.content)).toEqual([original_query, content]);
    expect(store.getState().sessions.sessions[0].name).toBe(original_query);
    expect(loadChatState()).toMatchObject({
      sessions: { sessions: [{ name: original_query.slice(0, 100_000) }] },
      chat: { messages: [
        { content: original_query.slice(0, 100_000) },
        { content: content.slice(0, 100_000), citations: context.citations },
      ] },
    });
    expect(store.getState().toast.toasts).toMatchObject([{
      severity: "warning",
      message: i18n.t("playground:persistence.shortened", { lng: "fr" }),
    }]);
  });
});
