import { Middleware, MiddlewareAPI, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "..";
import { removeOutboxItem, OutboxItem } from "../slices/outboxSlice";
import { uploadEncodedFile } from "../../api/storage";

let isFlushing = false; // Serialize retries so multiple actions don't re-upload the same item concurrently.

/**
 * Attempt to send a queued upload using the current auth token; returns early
 * when offline or unauthenticated so the item can be retried later.
 */
async function flushItem(item: OutboxItem, state: RootState) {
  const token = state.auth.accessToken;
  if (!token) return; // no token yet, keep in outbox
  if (item.kind === "user-file") {
    await uploadEncodedFile({
      encodedFile: item.dataUrl,
      originalName: item.originalName,
      accessToken: token,
      sessionId: item.sessionId,
      category: "files",
      metadata: {
        type: "user-file",
        ...(item.metadata ?? {}),
      },
    });
    return;
  }

  if (item.kind === "chat-archive") {
    const filename = item.label || `${item.sessionId}-${Date.now()}.chat.json`;
    await uploadEncodedFile({
      encodedFile: item.dataUrl,
      originalName: filename,
      accessToken: token,
      sessionId: item.sessionId,
      category: "chat",
      metadata: {
        type: "chat-archive",
        sessionid: item.sessionId,
      },
    });
    return;
  }
}

export const outboxMiddleware: Middleware<UnknownAction, RootState> = (store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>) => next => (action) => {
  const result = next(action);
  // After any action, attempt to flush a small number of items asynchronously
  queueMicrotask(async () => {
    if (isFlushing) return;
    isFlushing = true;
    try {
      let keepFlushing = true;
      while (keepFlushing) {
        const state = store.getState();
        const token = state.auth.accessToken;
        if (!token || state.outbox.items.length === 0) break;

        const batch = state.outbox.items.slice(0, 3);
        let progressed = false;
        for (const item of batch) {
          try {
            await flushItem(item, store.getState());
            store.dispatch(removeOutboxItem(item.id));
            progressed = true;
          } catch {
            // keep in outbox for next attempt
          }
        }
        if (!progressed) {
          keepFlushing = false; // avoid tight loop when nothing succeeds
        }
      }
    } finally {
      isFlushing = false;
    }
  });
  return result;
};
