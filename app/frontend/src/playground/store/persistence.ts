/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";

type PersistedState = Record<string, unknown>;

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
    // isLoadingBySessionId is intentionally omitted: in-flight requests do not
    // survive a page reload, so the map always starts empty.
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
    // Do not persist auth tokens
    const s = (state as Record<string, unknown>) || {};
    // Omit 'auth' key when persisting
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { auth, ...rest } = s;
    localStorage.setItem(CHAT_KEY, JSON.stringify(rest));
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