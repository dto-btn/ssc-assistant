import { createAction, Middleware, MiddlewareAPI, UnknownAction, Dispatch } from "@reduxjs/toolkit";
import type { RootState } from "..";
import { addMessage, Message } from "../slices/chatSlice";
import { addChatArchiveToOutbox } from "../slices/outboxSlice";
import {
  markSessionDirty,
  markSessionSyncing,
  markSessionSynced,
  markSessionError,
} from "../slices/syncSlice";
import { uploadEncodedFile } from "../../api/storage";
import { removeSession, renameSession } from "../slices/sessionSlice";
import { rehydrateSessionFromArchive, SessionRehydrationResult } from "../thunks/sessionBootstrapThunks";

export const requestArchive = createAction<{ sessionId: string }>("archiver/requestArchive");

// Archiver policy
const MAX_MESSAGES_BEFORE_ARCHIVE = 25; // archive when many messages accumulate
const IDLE_MS_BEFORE_ARCHIVE = 60_000; // 1 minute idle

type SessionTimers = Record<string, ReturnType<typeof setTimeout> | undefined>;
const timers: SessionTimers = {};
const lastArchivedSignature: Record<string, string | undefined> = {};

// Debounce archival so idle sessions eventually flush to storage even without
// hitting the hard message threshold.
function scheduleArchive(sessionId: string, store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) {
  if (timers[sessionId]) {
    clearTimeout(timers[sessionId]);
  }
  timers[sessionId] = setTimeout(() => {
    void doArchive(sessionId, store).catch(() => {
      // Intentionally swallow errors triggered by background archival so UI flow continues.
    });
  }, IDLE_MS_BEFORE_ARCHIVE);
}

/**
 * Serialize a session transcript and ship it to blob storage, falling back to
 * the local outbox when offline or unauthenticated.
 */
async function doArchive(sessionId: string, store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) {
  const state = store.getState();
  const accessToken = state.auth?.accessToken ?? null;
  const sessionRecord = state.sessions.sessions.find((session) => session.id === sessionId);

  const messages = state.chat.messages.filter(m => m.sessionId === sessionId);
  const hasQueuedArchive = store
    .getState()
    .outbox.items.some((item) => item.kind === "chat-archive" && item.sessionId === sessionId);

  if (messages.length === 0) {
    if (!hasQueuedArchive) {
      store.dispatch(markSessionSynced({ sessionId }));
    }
    return;
  }

  const lastMessage = messages[messages.length - 1];
  const sessionNameFragment = sessionRecord?.name?.trim() ?? "";
  const signature = `${messages.length}:${lastMessage?.id ?? ""}:${lastMessage?.timestamp ?? ""}:${sessionNameFragment}`;
  if (lastArchivedSignature[sessionId] === signature) {
    if (!hasQueuedArchive) {
      store.dispatch(markSessionSynced({ sessionId }));
    }
    return;
  }

  const archiveDoc = {
    sessionId,
    archivedAt: new Date().toISOString(),
    count: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.timestamp,
      citations: m.citations,
      attachments: m.attachments,
    } satisfies Partial<Message>)),
  };

  const payload = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(archiveDoc))));
  const archiveFileName = `${sessionId}.chat.json`;
  const lastUpdatedIso = new Date().toISOString();

  const queueArchive = () =>
    store.dispatch(addChatArchiveToOutbox({ sessionId, dataUrl: payload, label: archiveFileName }));

  if (!accessToken) {
    queueArchive();
    lastArchivedSignature[sessionId] = signature;
    return;
  }

  store.dispatch(markSessionSyncing({ sessionId }));
  try {
    await uploadEncodedFile({
      encodedFile: payload,
      originalName: archiveFileName,
      accessToken,
      sessionId,
      category: "chat",
      metadata: {
        type: "chat-archive",
        sessionid: sessionId,
        sessionname: sessionRecord?.name,
        lastupdated: lastUpdatedIso,
      },
    });
  } catch (error) {
    queueArchive();
    store.dispatch(
      markSessionError({
        sessionId,
        error: error instanceof Error ? error.message : undefined,
      })
    );
    lastArchivedSignature[sessionId] = signature;
    throw error;
  }
  lastArchivedSignature[sessionId] = signature;
  store.dispatch(markSessionSynced({ sessionId }));
}

export const archiverMiddleware: Middleware<UnknownAction, RootState> = (store) => (next) => (action) => {
  const result = next(action);

  if (addMessage.match(action)) {
    const { sessionId } = action.payload;
    const state: RootState = store.getState();
    const messages = state.chat.messages.filter(m => m.sessionId === sessionId);

    store.dispatch(markSessionDirty({ sessionId }));

    // Schedule idle archive after each message
    scheduleArchive(sessionId, store);

    // Threshold-based immediate archive
    if (messages.length >= MAX_MESSAGES_BEFORE_ARCHIVE) {
      doArchive(sessionId, store).catch(() => {/* swallow errors to avoid disrupting UI */});
    }
  }

  if (requestArchive.match(action)) {
    const { sessionId } = action.payload;
    store.dispatch(markSessionDirty({ sessionId }));
    doArchive(sessionId, store).catch(() => {/* swallow errors to avoid disrupting UI */});
  }

  if (renameSession.match(action)) {
    const { id: sessionId } = action.payload;
    if (sessionId) {
      const state: RootState = store.getState();
      const hasMessages = state.chat.messages.some((message) => message.sessionId === sessionId);
      if (hasMessages) {
        store.dispatch(requestArchive({ sessionId }));
      } else {
        Promise.resolve(
          store.dispatch(rehydrateSessionFromArchive(sessionId, { force: true })),
        )
          .then((rehydrationResult: SessionRehydrationResult | undefined) => {
            if (rehydrationResult?.restored || rehydrationResult?.hasArchive) {
              store.dispatch(requestArchive({ sessionId }));
            }
          })
          .catch(() => {
            // Ignore hydration failures; rename persistence will retry after history loads.
          });
      }
    }
  }

  if (removeSession.match(action)) {
    const sessionId = action.payload;
    const timer = timers[sessionId];
    if (timer) {
      clearTimeout(timer);
      delete timers[sessionId];
    }
    delete lastArchivedSignature[sessionId];
  }

  return result;
};
