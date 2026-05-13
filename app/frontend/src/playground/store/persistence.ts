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

const PERSISTED_ACTION_PREFIXES = [
  "chat/",
  "sessions/",
  "tools/",
  "models/",
  "quoted/",
  "user/",
  "outbox/",
  "sessionFiles/",
  "sync/",
  "ui/",
] as const;

const asRecord = (value: unknown): Record<string, unknown> =>
  (value && typeof value === "object") ? (value as Record<string, unknown>) : {};

const isPersistableMessage = (message: unknown): message is Record<string, unknown> => {
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
};

const trimMessagesForPersistence = (messages: unknown): unknown[] => {
  if (
    Array.isArray(messages)
    && messages.length <= MAX_PERSISTED_MESSAGES
    && messages.every(
      (message) => isPersistableMessage(message)
        && (message as Record<string, any>).content.length <= MAX_PERSISTED_CONTENT_CHARS
    )
  ) {
    return messages;
  }

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

/**
 * Drops malformed persisted message entries so hydration cannot crash reducers.
 */
const normalizePersistedMessages = (messages: unknown): unknown[] => {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.filter(isPersistableMessage);
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
    // Response phase is transient runtime state and must not survive reloads.
    assistantResponsePhaseBySessionId: {},
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
  const source = asRecord(state);
  const nextState: PersistedState = {};

  PERSISTED_SLICE_KEYS.forEach((key: PersistedSliceKey) => {
    if (!(key in source)) {
      return;
    }

    if (key === "chat") {
      const chat = asRecord(source.chat);
      const nextChat: Record<string, unknown> = {
        messages: trimMessagesForPersistence(chat.messages),
      };

      if (
        chat.orchestratorInsightsBySessionId
        && typeof chat.orchestratorInsightsBySessionId === "object"
      ) {
        nextChat.orchestratorInsightsBySessionId = chat.orchestratorInsightsBySessionId;
      }

      nextState.chat = {
        ...nextChat,
      };
      return;
    }

    if (key === "ui") {
      const ui = asRecord(source.ui);
      nextState.ui = {
        isSidebarCollapsed:
          typeof ui.isSidebarCollapsed === "boolean" ? ui.isSidebarCollapsed : false,
      };
      return;
    }

    nextState[key] = source[key];
  });

  return nextState;
}

const hasPersistedChatChanged = (
  previousChat: PersistedState["chat"],
  nextChat: PersistedState["chat"],
): boolean => {
  const previous = (previousChat as Record<string, unknown> | undefined) ?? {};
  const next = (nextChat as Record<string, unknown> | undefined) ?? {};

  return previous.messages !== next.messages
    || previous.orchestratorInsightsBySessionId !== next.orchestratorInsightsBySessionId;
};

const hasPersistedUiChanged = (
  previousUi: PersistedState["ui"],
  nextUi: PersistedState["ui"],
): boolean => {
  const previous = (previousUi as Record<string, unknown> | undefined) ?? {};
  const next = (nextUi as Record<string, unknown> | undefined) ?? {};

  return previous.isSidebarCollapsed !== next.isSidebarCollapsed;
};

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

  return PERSISTED_SLICE_KEYS.some((key) => {
    if (key === "chat") {
      return hasPersistedChatChanged(previousState.chat, nextState.chat);
    }

    if (key === "ui") {
      return hasPersistedUiChanged(previousState.ui, nextState.ui);
    }

    return previousState[key] !== nextState[key];
  });
}

export function shouldPersistAction(actionType: string | undefined): boolean {
  if (!actionType) {
    return false;
  }

  return PERSISTED_ACTION_PREFIXES.some((prefix) => actionType.startsWith(prefix));
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