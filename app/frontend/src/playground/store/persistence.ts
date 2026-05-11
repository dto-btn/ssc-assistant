/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";
const MAX_PERSISTED_MESSAGES = 250;
const MAX_PERSISTED_CONTENT_CHARS = 20_000;

type PersistedState = Record<string, unknown>;

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === "object") ? (value as Record<string, unknown>) : {};

const trimMessagesForPersistence = (messages: unknown): unknown[] => {
  const normalized = normalizePersistedMessages(messages);
  const recent = normalized.slice(-MAX_PERSISTED_MESSAGES);

  return recent.map((entry) => {
    const record = entry as Record<string, unknown>;
    const content = typeof record.content === "string"
      ? record.content.slice(0, MAX_PERSISTED_CONTENT_CHARS)
      : "";

    return {
      ...record,
      content,
    };
  });
};

const buildPersistedSnapshot = (state: Record<string, unknown>): PersistedState => {
  // Persist only lightweight state needed to restore UX; skip heavy/sensitive slices.
  const chat = asRecord(state.chat);
  const ui = asRecord(state.ui);

  return {
    chat: {
      messages: trimMessagesForPersistence(chat.messages),
      assistantResponsePhaseBySessionId:
        chat.assistantResponsePhaseBySessionId && typeof chat.assistantResponsePhaseBySessionId === "object"
          ? chat.assistantResponsePhaseBySessionId
          : {},
      orchestratorInsightsBySessionId:
        chat.orchestratorInsightsBySessionId && typeof chat.orchestratorInsightsBySessionId === "object"
          ? chat.orchestratorInsightsBySessionId
          : {},
      isLoadingBySessionId: {},
    },
    sessions: asRecord(state.sessions),
    tools: asRecord(state.tools),
    models: asRecord(state.models),
    quoted: asRecord(state.quoted),
    sessionFiles: asRecord(state.sessionFiles),
    sync: asRecord(state.sync),
    ui: {
      isSidebarCollapsed:
        typeof ui.isSidebarCollapsed === "boolean" ? ui.isSidebarCollapsed : false,
      isMobileSidebarOpen: false,
      isDeletingAllChats: false,
    },
  };
};

/**
 * Drops malformed persisted message entries so hydration cannot crash reducers.
 */
const normalizePersistedMessages = (messages: unknown): unknown[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter((message) => {
    if (!message || typeof message !== "object") {
      return false;
    }

    const record = message as Record<string, unknown>;
    return (
      typeof record.id === "string"
      && typeof record.sessionId === "string"
      && (record.role === "user" || record.role === "assistant" || record.role === "system")
      && typeof record.content === "string"
      && typeof record.timestamp === "number"
    );
  });
};

/**
 * Migrates older local-storage payloads to the current reducer contract.
 */
const migratePersistedState = (parsed: PersistedState): PersistedState => {
  const next = { ...parsed };
  const chat = (next.chat as Record<string, unknown> | undefined) ?? {};
  const ui = (next.ui as Record<string, unknown> | undefined) ?? {};

  next.chat = {
    messages: normalizePersistedMessages(chat.messages),
    isLoadingBySessionId: {},
    assistantResponsePhaseBySessionId:
      chat.assistantResponsePhaseBySessionId && typeof chat.assistantResponsePhaseBySessionId === "object"
        ? chat.assistantResponsePhaseBySessionId
        : {},
    orchestratorInsightsBySessionId:
      chat.orchestratorInsightsBySessionId && typeof chat.orchestratorInsightsBySessionId === "object"
        ? chat.orchestratorInsightsBySessionId
        : {},
  };

  next.ui = {
    isSidebarCollapsed:
      typeof ui.isSidebarCollapsed === "boolean" ? ui.isSidebarCollapsed : false,
    // Always start closed on page load for mobile overlays.
    isMobileSidebarOpen: false,
    isDeletingAllChats: false,
  };

  return next;
};

/**
 * Persists redux state to localStorage while excluding sensitive auth data.
 */
export function saveChatState(state: unknown) {
  try {
    const source = (state as Record<string, unknown>) || {};
    localStorage.setItem(CHAT_KEY, JSON.stringify(buildPersistedSnapshot(source)));
  } catch {
    // ignore persistence errors (quota/unavailable)
  }
}

/**
 * Loads and migrates persisted playground state, returning undefined on any
 * read/parse failure so store initialization can continue safely.
 */
export function loadChatState() {
  try {
    const raw = localStorage.getItem(CHAT_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as PersistedState;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }
    return migratePersistedState(parsed);
  } catch {
    return undefined;
  }
}