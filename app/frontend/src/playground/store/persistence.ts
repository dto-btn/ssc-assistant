/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";

type PersistedState = Record<string, unknown>;

const PERSISTED_SLICE_KEYS = [
  "chat",
  "sessions",
  "tools",
  "models",
  "quoted",
  "user",
  "outbox",
  "sessionFiles",
  "sync",
  "ui",
] as const;

type PersistedSliceKey = (typeof PERSISTED_SLICE_KEYS)[number];

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
export function createPersistableState(state: unknown): PersistedState {
  const source = (state as Record<string, unknown>) || {};
  const nextState: PersistedState = {};

  PERSISTED_SLICE_KEYS.forEach((key: PersistedSliceKey) => {
    if (key in source) {
      nextState[key] = source[key];
    }
  });

  return nextState;
}

/**
 * Shallowly compares projected persisted slices so the store can skip work
 * when only transient branches changed.
 */
export function hasPersistableStateChanged(
  previousState: PersistedState | undefined,
  nextState: PersistedState,
): boolean {
  if (!previousState) {
    return true;
  }

  return PERSISTED_SLICE_KEYS.some((key) => previousState[key] !== nextState[key]);
}

/**
 * Persists a pre-projected durable playground state snapshot.
 */
export function saveChatState(state: unknown) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(createPersistableState(state)));
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