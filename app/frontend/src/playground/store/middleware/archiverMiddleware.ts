import { Middleware, MiddlewareAPI, UnknownAction, Dispatch } from "@reduxjs/toolkit";
import { RootState } from "..";
import { addMessage, Message } from "../slices/chatSlice";
import { addChatArchiveToOutbox } from "../slices/outboxSlice";
import { uploadEncodedFile } from "../../api/storage";

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

  const messages = state.chat.messages.filter(m => m.sessionId === sessionId);
  if (messages.length === 0) return;

  const lastMessage = messages[messages.length - 1];
  const signature = `${messages.length}:${lastMessage?.id ?? ""}:${lastMessage?.timestamp ?? ""}`;
  if (lastArchivedSignature[sessionId] === signature) {
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
  const timestamp = Date.now();
  const archiveFileName = `${sessionId}-${timestamp}.chat.json`;

  const queueArchive = () =>
    store.dispatch(addChatArchiveToOutbox({ sessionId, dataUrl: payload, label: archiveFileName }));

  if (!accessToken) {
    queueArchive();
    lastArchivedSignature[sessionId] = signature;
    return;
  }

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
      },
    });
  } catch (error) {
    queueArchive();
    lastArchivedSignature[sessionId] = signature;
    throw error;
  }
  lastArchivedSignature[sessionId] = signature;
}

export const archiverMiddleware: Middleware<UnknownAction, RootState> = (store) => (next) => (action) => {
  const result = next(action);

  if (addMessage.match(action)) {
    const { sessionId } = action.payload;
    const state: RootState = store.getState();
    const messages = state.chat.messages.filter(m => m.sessionId === sessionId);

    // Schedule idle archive after each message
    scheduleArchive(sessionId, store);

    // Threshold-based immediate archive
    if (messages.length >= MAX_MESSAGES_BEFORE_ARCHIVE) {
      doArchive(sessionId, store).catch(() => {/* swallow errors to avoid disrupting UI */});
    }
  }

  return result;
};
