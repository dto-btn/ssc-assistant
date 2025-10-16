import { Middleware, MiddlewareAPI, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "..";
import { removeOutboxItem, OutboxItem } from "../slices/outboxSlice";
import { uploadEncodedFile } from "../../api/storage";

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
      category: "files",
      metadata: {
        type: "user-file",
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
    const state = store.getState();
    const token = state.auth.accessToken;
    if (!token || state.outbox.items.length === 0) return;
    const batch = state.outbox.items.slice(0, 3);
    for (const item of batch) {
      try {
        await flushItem(item, state);
        store.dispatch(removeOutboxItem(item.id));
      } catch {
        // keep in outbox for next attempt
      }
    }
  });
  return result;
};
