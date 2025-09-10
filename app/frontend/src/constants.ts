
// For some reason, at 300, a horizontal scrollbar appears in the left menu
// and at 301, it disappears.
export const LEFT_MENU_WIDTH = 301;// This is the time-to-live for a snackbar in milliseconds. After this time, the snackbar will

// This debounces the snackbar so that we don't show multiple snackbars in quick succession.
// This is only used if a debounceKey is passed to the show function.
export const SNACKBAR_DEBOUNCE_MS = 100;

// How long each snackbar will be shown for in milliseconds. After this time, the snackbar will
// be hidden automatically.
export const SNACKBAR_TTL_MS = 6000;

/**
 * Snackbars can get triggered multiple times upon rendering the page.
 * This debounce key is used to prevent multiple snackbars from showing in quick succession.
 * Also see SNACKBAR_DEBOUNCE_MS.
 */
export enum SNACKBAR_DEBOUNCE_KEYS {
    STORAGE_FULL_ERROR,
    CHAT_HISTORY_FULL_ERROR,
    SUGGEST_CONTEXT_ERROR
}

// This is the maximum number of messages that can be sent in a single request.
// It works by taking the last 10 messages from the chat history and sending them to the API.
export const MAX_MESSAGES_SENT = 10;

// This is the maximum number of messages that we save in chat history.
// It used to be 10, but we changed it to Infinity to allow for better user experience.
export const MAX_CHAT_HISTORIES_LENGTH = Infinity;

// tools defined here are mutually exclusive.
export const MUTUALLY_EXCLUSIVE_TOOLS = [ "bits", "pmcoe"]