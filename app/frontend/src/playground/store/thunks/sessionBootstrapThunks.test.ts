import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi, beforeEach } from "vitest";
import sessionsReducer from "../slices/sessionSlice";
import chatReducer from "../slices/chatSlice";
import sessionFilesReducer from "../slices/sessionFilesSlice";
import { bootstrapSessionsFromStorage } from "./sessionBootstrapThunks";

vi.mock("../../api/storage", () => ({
  listSessionFiles: vi.fn(),
  fetchFileDataUrl: vi.fn(),
}));

import { listSessionFiles, fetchFileDataUrl } from "../../api/storage";

const listSessionFilesMock = vi.mocked(listSessionFiles);
const fetchFileDataUrlMock = vi.mocked(fetchFileDataUrl);

const makeStore = (accessToken = "valid-token") => {
  const authReducer = (state = { accessToken }) => state;

  return configureStore({
    reducer: {
      sessions: sessionsReducer,
      chat: chatReducer,
      sessionFiles: sessionFilesReducer,
      auth: authReducer,
    } as const,
  });
};

describe("bootstrapSessionsFromStorage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores session metadata without eagerly hydrating every archive", async () => {
    const store = makeStore();

    listSessionFilesMock.mockResolvedValue({
      files: [
        {
          blobName: "session-a.chat.json",
          url: "/files/session-a.chat.json",
          originalName: "session-a.chat.json",
          sessionId: "session-a",
          sessionName: "Older chat",
          category: "chat",
          metadataType: "chat-archive",
          uploadedAt: "2026-05-07T10:00:00.000Z",
          lastUpdated: "2026-05-07T10:00:00.000Z",
        },
        {
          blobName: "session-b.chat.json",
          url: "/files/session-b.chat.json",
          originalName: "session-b.chat.json",
          sessionId: "session-b",
          sessionName: "Newest chat",
          category: "chat",
          metadataType: "chat-archive",
          uploadedAt: "2026-05-08T10:00:00.000Z",
          lastUpdated: "2026-05-08T10:00:00.000Z",
        },
      ],
      deletedSessionIds: [],
      sessionDeleted: false,
    });

    await store.dispatch(bootstrapSessionsFromStorage() as never);

    const state = store.getState();

    expect(state.sessions.sessions).toHaveLength(2);
    expect(state.sessions.currentSessionId).toBe("session-b");
    expect(state.sessionFiles.bySessionId["session-a"]).toHaveLength(1);
    expect(state.sessionFiles.bySessionId["session-b"]).toHaveLength(1);
    expect(state.chat.messages).toEqual([]);
    expect(fetchFileDataUrlMock).not.toHaveBeenCalled();
  });
});