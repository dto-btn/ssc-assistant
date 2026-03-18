/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";

type PersistedState = Record<string, unknown>;

const migratePersistedState = (parsed: PersistedState): PersistedState => {
  const next = { ...parsed };
  const chat = (next.chat as Record<string, unknown> | undefined) ?? {};

  next.chat = {
    messages: Array.isArray(chat.messages) ? chat.messages : [],
    isLoading: typeof chat.isLoading === "boolean" ? chat.isLoading : false,
    orchestratorInsightsBySessionId:
      chat.orchestratorInsightsBySessionId && typeof chat.orchestratorInsightsBySessionId === "object"
        ? chat.orchestratorInsightsBySessionId
        : {},
  };

  return next;
};

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