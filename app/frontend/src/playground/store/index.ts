import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "./slices/chatSlice";
import sessionReducer from "./slices/sessionSlice";
import toolReducer from "./slices/toolSlice";
import modelReducer from "./slices/modelSlice";
import toastReducer from "./slices/toastSlice";
import quotedReducer from "./slices/quotedSlice";
import { assistantMiddleware } from "./middleware/assistantMiddleware";
import { saveChatState, loadChatState } from "./persistence";

export const store = configureStore({
  reducer: {
    chat: chatReducer,
    sessions: sessionReducer,
    tools: toolReducer,
    models: modelReducer,
    toast: toastReducer,
    quoted: quotedReducer,
  },
  preloadedState: loadChatState(),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(assistantMiddleware),
});

store.subscribe(() => {
  saveChatState(store.getState());
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;