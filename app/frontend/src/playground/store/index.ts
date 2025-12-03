/**
 * Playground store index
 *
 * Entry point for the playground Redux store: sets up reducers, middleware,
 * and persistence. Exported items are used by the `Playground` UI to provide
 * state and dispatch throughout the playground components.
 */

import {
  configureStore,
  combineReducers,
  ThunkAction,
  UnknownAction,
} from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import sessionReducer from "./slices/sessionSlice";
import toolReducer from "./slices/toolSlice";
import modelReducer from "./slices/modelSlice";
import toastReducer from "./slices/toastSlice";
import quotedReducer from "./slices/quotedSlice";
import authReducer from "./slices/authSlice";
import { archiverMiddleware, requestArchive } from "./middleware/archiverMiddleware";
import { outboxMiddleware } from "./middleware/outboxMiddleware";
import userReducer from "./slices/userSlice";
import { saveChatState, loadChatState } from "./persistence";
import outboxReducer from "./slices/outboxSlice";
import sessionFilesReducer from "./slices/sessionFilesSlice";
import syncReducer from "./slices/syncSlice";

const rootReducer = combineReducers({
  chat: chatReducer,
  sessions: sessionReducer,
  tools: toolReducer,
  models: modelReducer,
  toast: toastReducer,
  quoted: quotedReducer,
  auth: authReducer,
  user: userReducer,
  outbox: outboxReducer,
  sessionFiles: sessionFilesReducer,
  sync: syncReducer,
});

// Infer the RootState type *before* using it for preloadedState
export type RootState = ReturnType<typeof rootReducer>;

// Use Partial<RootState> for the preloaded state
const preloadedState = loadChatState() as Partial<RootState>;

export const store = configureStore({
  reducer: rootReducer,
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    // Persist chat archives and queued uploads by enriching the default stack.
    getDefaultMiddleware().concat(archiverMiddleware, outboxMiddleware),
});

store.subscribe(() => {
  saveChatState(store.getState());
});

const initialStateSnapshot = store.getState();
const sessionsNeedingArchive = Object.entries(initialStateSnapshot.sync?.byId ?? {})
  .filter(([, entry]) => entry?.status === "pending" || entry?.status === "syncing" || entry?.status === "error")
  .map(([sessionId]) => sessionId)
  .filter((sessionId) => !initialStateSnapshot.outbox.items.some((item) => item.kind === "chat-archive" && item.sessionId === sessionId));

if (sessionsNeedingArchive.length > 0) {
  const defer = typeof queueMicrotask === "function"
    ? queueMicrotask
    : (cb: () => void) => { setTimeout(cb, 0); };

  defer(() => {
    sessionsNeedingArchive.forEach((sessionId) => {
      store.dispatch(requestArchive({ sessionId }));
    });
  });
}

export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<ReturnType, RootState, unknown, UnknownAction>;
