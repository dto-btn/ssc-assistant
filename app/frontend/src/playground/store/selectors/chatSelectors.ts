/**
 * Chat selectors
 *
 * Selector helpers for deriving values from the playground chat slice, such
 * as visible messages, quoted message lookup, and aggregate counts.
 */

import { createSelector } from "reselect";
import { RootState } from "../../store";
import type { AssistantResponsePhase, Message } from "../slices/chatSlice";

// Input selectors
const selectMessages = (state: RootState) => state.chat.messages;
const selectCurrentSessionId = (state: RootState) =>
  state.sessions.currentSessionId;
const selectSessionLoadingById = (state: RootState) => state.chat.isLoadingBySessionId;
const selectAssistantResponsePhaseBySessionId = (state: RootState) => state.chat.assistantResponsePhaseBySessionId;

const WAITING_ASSISTANT_PHASES: ReadonlySet<AssistantResponsePhase> = new Set([
  "waiting-first-token",
  "drafting",
  "streaming",
]);

const EMPTY_MESSAGES: Message[] = [];
const sessionMessagesCache = new WeakMap<Message[], Map<string, Message[]>>();

const getCachedSessionMessages = (
  messages: Message[],
  sessionId: string | null | undefined,
): Message[] => {
  if (!sessionId) {
    return EMPTY_MESSAGES;
  }

  let sessionCache = sessionMessagesCache.get(messages);
  if (!sessionCache) {
    sessionCache = new Map<string, Message[]>();
    sessionMessagesCache.set(messages, sessionCache);
  }

  const cachedMessages = sessionCache.get(sessionId);
  if (cachedMessages) {
    return cachedMessages;
  }

  const filteredMessages = messages.filter((message) => message.sessionId === sessionId);
  sessionCache.set(sessionId, filteredMessages);
  return filteredMessages;
};

export const selectMessagesForSession = (
  state: RootState,
  sessionId: string | null | undefined,
): Message[] => getCachedSessionMessages(selectMessages(state), sessionId);

export const selectHasMessagesForSession = (
  state: RootState,
  sessionId: string | null | undefined,
): boolean => selectMessagesForSession(state, sessionId).length > 0;

// Memoized selector for filtering messages by sessionId
export const selectMessagesBySessionId = createSelector(
  [selectMessages, selectCurrentSessionId],
  (messages, currentSessionId) => getCachedSessionMessages(messages, currentSessionId)
);

export const selectAssistantResponsePhaseForSession = (
  state: RootState,
  sessionId: string | null | undefined,
): AssistantResponsePhase => {
  if (!sessionId) {
    return "idle";
  }

  return state.chat.assistantResponsePhaseBySessionId[sessionId] ?? "idle";
};

export const selectIsSessionWaitingForAssistant = createSelector(
  [
    selectSessionLoadingById,
    selectAssistantResponsePhaseBySessionId,
    (_: RootState, sessionId: string | null | undefined) => sessionId,
  ],
  (loadingBySessionId, phaseBySessionId, sessionId): boolean => {
    if (!sessionId) {
      return false;
    }

    if (Boolean(loadingBySessionId[sessionId])) {
      return true;
    }

    const phase = phaseBySessionId[sessionId] ?? "idle";
    return WAITING_ASSISTANT_PHASES.has(phase);
  }
);

export const selectIsSessionWaitingById = createSelector(
  [selectSessionLoadingById, selectAssistantResponsePhaseBySessionId],
  (loadingBySessionId, phaseBySessionId): Record<string, boolean> => {
    const sessionIds = new Set([
      ...Object.keys(loadingBySessionId),
      ...Object.keys(phaseBySessionId),
    ]);

    const waitingBySessionId: Record<string, boolean> = {};

    sessionIds.forEach((sessionId) => {
      const isLoading = Boolean(loadingBySessionId[sessionId]);
      const phase = phaseBySessionId[sessionId] ?? "idle";
      waitingBySessionId[sessionId] = isLoading || WAITING_ASSISTANT_PHASES.has(phase);
    });

    return waitingBySessionId;
  }
);
