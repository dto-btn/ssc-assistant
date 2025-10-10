import { Middleware, MiddlewareAPI, Dispatch, UnknownAction } from "@reduxjs/toolkit";
import { RootState } from "..";
import { removeOutboxItem, OutboxItem } from "../slices/outboxSlice";
import { createBlobViaApi, updateBlobMetadata, getOidFromAccessToken, moveBlob } from "../../api/storage";

async function flushItem(item: OutboxItem, state: RootState) {
  const token = state.auth.accessToken;
  if (!token) return; // no token yet, keep in outbox
  const oid = getOidFromAccessToken(token);

  if (item.kind === "user-file") {
    const res = await createBlobViaApi({ encodedFile: item.dataUrl, name: item.originalName, accessToken: token });
    if (oid) {
      const destName = `users/${oid}/files/${item.originalName}`;
  try { await moveBlob({ sourceName: res.blobName, destName, accessToken: token }); } catch (e) { /* keep at root if move fails */ }
      try {
        await updateBlobMetadata({ blobName: destName, metadata: { type: "user-file", originalname: item.originalName, uploadedat: new Date().toISOString() }, accessToken: token });
      } catch (e) { /* ignore tagging errors */ }
    }
    return;
  }

  if (item.kind === "chat-archive") {
    const filename = item.label || `${item.sessionId}-${Date.now()}.chat.json`;
    const prefix = oid ? `users/${oid}/history/archives` : `archives`;
    const name = `${prefix}/${filename}`;
    await createBlobViaApi({ encodedFile: item.dataUrl, name, accessToken: token });
  try { await updateBlobMetadata({ blobName: name, metadata: { type: "chat-archive", sessionId: item.sessionId }, accessToken: token }); } catch (e) { /* ignore tagging errors */ }
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
