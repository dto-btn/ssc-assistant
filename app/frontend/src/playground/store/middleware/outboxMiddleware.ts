import { Middleware, MiddlewareAPI, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "..";
import { removeOutboxItem, OutboxItem } from "../slices/outboxSlice";
import { uploadEncodedFile } from "../../api/storage";
import {
  markSessionError,
  markSessionSynced,
  markSessionSyncing,
} from "../slices/syncSlice";

let isFlushing = false; // Serialize retries so multiple actions don't re-upload the same item concurrently.

/**
 * Attempt to send a queued upload using the current auth token; returns early
 * when offline or unauthenticated so the item can be retried later.
 */
type FlushResult = "success" | "skip" | "failed";

async function flushItem(
  item: OutboxItem,
  store: MiddlewareAPI<Dispatch<UnknownAction>, RootState>,
): Promise<FlushResult> {
  const token = store.getState().auth.accessToken;
  if (!token) {
    return "skip";
  }

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
    return "success";
  }

  if (item.kind === "chat-archive") {
    store.dispatch(markSessionSyncing({ sessionId: item.sessionId }));
    const filename = item.label || `${item.sessionId}.chat.json`;
    const sessionRecord = store.getState().sessions.sessions.find((session) => session.id === item.sessionId);
    try {
      await uploadEncodedFile({
        encodedFile: item.dataUrl,
        originalName: filename,
        accessToken: token,
        sessionId: item.sessionId,
        category: "chat",
        metadata: {
          type: "chat-archive",
          sessionid: item.sessionId,
          sessionname: sessionRecord?.name,
          lastupdated: new Date().toISOString(),
        },
      });
      store.dispatch(markSessionSynced({ sessionId: item.sessionId }));
      return "success";
    } catch (error) {
      store.dispatch(
        markSessionError({
          sessionId: item.sessionId,
          error: error instanceof Error ? error.message : undefined,
        })
      );
      return "failed";
    }
  }

  return "success";
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
            const outcome = await flushItem(item, store);
            if (outcome === "success") {
              store.dispatch(removeOutboxItem(item.id));
              progressed = true;
            }
            if (outcome === "skip") {
              keepFlushing = false;
              break;
            }
          } catch {
            if (item.kind === "chat-archive") {
              store.dispatch(markSessionError({ sessionId: item.sessionId }));
            }
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
