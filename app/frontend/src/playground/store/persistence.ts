/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";

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
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}