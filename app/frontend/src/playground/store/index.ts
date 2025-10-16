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
} from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import sessionReducer from "./slices/sessionSlice";
import toolReducer from "./slices/toolSlice";
import modelReducer from "./slices/modelSlice";
import toastReducer from "./slices/toastSlice";
import quotedReducer from "./slices/quotedSlice";
import authReducer from "./slices/authSlice";
import { archiverMiddleware } from "./middleware/archiverMiddleware";
import { outboxMiddleware } from "./middleware/outboxMiddleware";
import { saveChatState, loadChatState } from "./persistence";
import outboxReducer from "./slices/outboxSlice";
import sessionFilesReducer from "./slices/sessionFilesSlice";

const rootReducer = combineReducers({
  chat: chatReducer,
  sessions: sessionReducer,
  tools: toolReducer,
  models: modelReducer,
  toast: toastReducer,
  quoted: quotedReducer,
  auth: authReducer,
  outbox: outboxReducer,
  sessionFiles: sessionFilesReducer,
});

// Infer the RootState type *before* using it for preloadedState
export type RootState = ReturnType<typeof rootReducer>;

// Use Partial<RootState> for the preloaded state
const preloadedState = loadChatState() as Partial<RootState>;

export const store = configureStore({
  reducer: rootReducer,
  preloadedState,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(archiverMiddleware, outboxMiddleware),
});

store.subscribe(() => {
  saveChatState(store.getState());
});

export type AppDispatch = typeof store.dispatch;
