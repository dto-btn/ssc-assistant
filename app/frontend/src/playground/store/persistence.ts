/**
 * Playground store persistence helpers
 *
 * Contains logic for saving and restoring playground session state to local
 * storage or another persistence backend. Used by the store setup in
 * `store/index.ts` to hydrate initial state and persist updates.
 */

const CHAT_KEY = "playground_chat_state";

export function saveChatState(state: any) {
  try {
    localStorage.setItem(CHAT_KEY, JSON.stringify(state));
  } catch {}
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