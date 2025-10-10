import { Middleware, MiddlewareAPI, UnknownAction, Dispatch } from "@reduxjs/toolkit";
import { RootState } from "..";
import { addMessage, clearSessionMessages, Message } from "../slices/chatSlice";
import { addChatArchiveToOutbox } from "../slices/outboxSlice";
import { createBlobViaApi } from "../../api/storage";

// Archiver policy
const MAX_MESSAGES_BEFORE_ARCHIVE = 25; // archive when many messages accumulate
const IDLE_MS_BEFORE_ARCHIVE = 60_000; // 1 minute idle

type SessionTimers = Record<string, number | undefined>;
const timers: SessionTimers = {};

function scheduleArchive(sessionId: string, store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) {
  if (timers[sessionId]) {
    clearTimeout(timers[sessionId]);
  }
  timers[sessionId] = setTimeout(() => doArchive(sessionId, store), IDLE_MS_BEFORE_ARCHIVE) as unknown as number;
}

async function doArchive(sessionId: string, store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) {
  const state = store.getState();
  const accessToken = state.auth?.accessToken ?? null;
  if (!accessToken) return;

  const messages = state.chat.messages.filter(m => m.sessionId === sessionId);
  if (messages.length === 0) return;

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

  // Upload JSON as a file to blob storage using the secured API
  const payload = "data:application/json;base64," + btoa(unescape(encodeURIComponent(JSON.stringify(archiveDoc))));
  // Queue to outbox for localStorage-first
  store.dispatch(addChatArchiveToOutbox({ sessionId, dataUrl: payload, label: `${sessionId}-${Date.now()}.chat.json` }));
  // Convention: per-user folder structure: users/<oid>/history/archives/<session>-<ts>.json
  const oid = state.auth?.accessToken ? (await import("../../api/storage").then(({ getOidFromAccessToken }) => getOidFromAccessToken(state.auth!.accessToken!))) : undefined;
  const basePrefix = oid ? `users/${oid}/history/archives` : `archives`;
  const archiveName = `${basePrefix}/${sessionId}-${Date.now()}.chat.json`;
  await createBlobViaApi({ encodedFile: payload, name: archiveName, accessToken });
  // Tag standardized metadata for RAG discovery (non-destructive merge): type=chat-archive, sessionId
  try {
    // archiveName is the blob name as uploaded
    await import("../../api/storage").then(({ updateBlobMetadata }) =>
      updateBlobMetadata({ blobName: archiveName, metadata: { type: "chat-archive", sessionId }, accessToken })
    );
  } catch {
    // metadata update is best-effort; ignore failures
  }

  // Clear archived messages from memory for that session
  store.dispatch(clearSessionMessages(sessionId));
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
