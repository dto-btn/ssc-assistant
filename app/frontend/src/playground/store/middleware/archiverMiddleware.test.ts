import { configureStore, type Middleware } from "@reduxjs/toolkit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../api/storage", () => ({
  uploadEncodedFile: vi.fn().mockResolvedValue({}),
  isRetriableUploadError: vi.fn().mockReturnValue(true),
  listSessionFiles: vi.fn(),
  fetchFileDataUrl: vi.fn(),
}));

import { uploadEncodedFile } from "../../api/storage";
import { archiverMiddleware } from "./archiverMiddleware";
import chatReducer, { addMessage } from "../slices/chatSlice";
import sessionsReducer, { addSession, renameSession } from "../slices/sessionSlice";
import outboxReducer from "../slices/outboxSlice";
import syncReducer from "../slices/syncSlice";
import sessionFilesReducer from "../slices/sessionFilesSlice";

const uploadMock = vi.mocked(uploadEncodedFile);

const MESSAGE_TIME = Date.parse("2026-05-09T09:00:00.000Z");
const RENAME_TIME = Date.parse("2026-05-10T15:00:00.000Z");

const makeStore = (accessToken: string | null) =>
  configureStore({
    reducer: {
      chat: chatReducer,
      sessions: sessionsReducer,
      outbox: outboxReducer,
      sync: syncReducer,
      sessionFiles: sessionFilesReducer,
      auth: (state: { accessToken: string | null } = { accessToken }) => state,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false }).concat(archiverMiddleware as unknown as Middleware),
  });

const seedAndRename = (store: ReturnType<typeof makeStore>, sessionId: string) => {
  vi.setSystemTime(MESSAGE_TIME);
  store.dispatch(addSession({ id: sessionId, name: "Original", createdAt: MESSAGE_TIME, isNewChat: false }));
  store.dispatch(addMessage({ sessionId, role: "user", content: "Hello" }));
  vi.setSystemTime(RENAME_TIME);
  store.dispatch(renameSession({ id: sessionId, name: "Renamed" }));
};

describe("archiverMiddleware last-message metadata", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    uploadMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("persists the last message time separately from the rename-triggered write time", async () => {
    const store = makeStore("token");
    seedAndRename(store, "rename-online");
    await vi.waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));

    const metadata = uploadMock.mock.calls[0][0].metadata as Record<string, string>;
    expect(metadata.sessionname).toBe("Renamed");
    expect(metadata.lastmessageat).toBe(new Date(MESSAGE_TIME).toISOString());
    expect(metadata.lastupdated).toBe(new Date(RENAME_TIME).toISOString());
  });

  it("carries the last message time into the offline outbox", () => {
    const store = makeStore(null);
    seedAndRename(store, "rename-offline");

    const [item] = store.getState().outbox.items;
    expect(item).toMatchObject({
      kind: "chat-archive",
      sessionId: "rename-offline",
      lastMessageAt: new Date(MESSAGE_TIME).toISOString(),
    });
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
