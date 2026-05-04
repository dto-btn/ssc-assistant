import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import chatReducer from "../slices/chatSlice";
import sessionFilesReducer from "../slices/sessionFilesSlice";
import sessionReducer from "../slices/sessionSlice";
import { bootstrapSessionsFromStorage, loadMoreSessionsFromStorage } from "./sessionBootstrapThunks";
import { listSessionFiles } from "../../api/storage";

vi.mock("../../api/storage", () => ({
  listSessionFiles: vi.fn(),
  fetchFileDataUrl: vi.fn(),
}));

vi.mock("./sessionManagementThunks", () => ({
  applyRemoteSessionDeletion: vi.fn(() => ({ type: "sessions/applyRemoteDeletionMock" })),
}));

const listSessionFilesMock = vi.mocked(listSessionFiles);

const makeStore = (preloadedState?: Record<string, unknown>) => {
  const authReducer = (state = { accessToken: "test-token" }) => state;

  return configureStore({
    reducer: {
      sessions: sessionReducer,
      chat: chatReducer,
      sessionFiles: sessionFilesReducer,
      auth: authReducer,
    } as const,
    preloadedState: preloadedState as never,
  });
};

describe("sessionBootstrapThunks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("bootstraps the first page of remote sessions and tracks the next offset", async () => {
    listSessionFilesMock.mockResolvedValue({
      files: [
        {
          blobName: "blob-newer",
          url: "/blob-newer",
          originalName: "attachment.txt",
          sessionId: "session-newer",
          sessionName: "Newer Session",
          uploadedAt: "2024-01-02T00:00:00Z",
          category: "files",
        },
        {
          blobName: "blob-older",
          url: "/blob-older",
          originalName: "attachment.txt",
          sessionId: "session-older",
          sessionName: "Older Session",
          uploadedAt: "2024-01-01T00:00:00Z",
          category: "files",
        },
      ],
      deletedSessionIds: [],
      sessionDeleted: false,
      hasMore: true,
      nextOffset: 25,
    });

    const store = makeStore();

    await store.dispatch(bootstrapSessionsFromStorage() as never);

    expect(listSessionFilesMock).toHaveBeenCalledWith({
      accessToken: "test-token",
      limit: 25,
      offset: 0,
    });

    const state = store.getState();
    expect(state.sessions.sessions.map((session) => session.id)).toEqual([
      "session-older",
      "session-newer",
    ]);
    expect(state.sessions.currentSessionId).toBe("session-newer");
    expect(state.sessions.remoteSessionPaging).toMatchObject({
      hasMore: true,
      nextOffset: 25,
      hasLoadedInitialPage: true,
      isInitialLoading: false,
      isLoadingMore: false,
    });
  });

  it("loads more sessions without replacing the current selection", async () => {
    listSessionFilesMock.mockResolvedValue({
      files: [
        {
          blobName: "blob-oldest",
          url: "/blob-oldest",
          originalName: "attachment.txt",
          sessionId: "session-oldest",
          sessionName: "Oldest Session",
          uploadedAt: "2023-12-01T00:00:00Z",
          category: "files",
        },
      ],
      deletedSessionIds: [],
      sessionDeleted: false,
      hasMore: false,
      nextOffset: null,
    });

    const store = makeStore({
      sessions: {
        sessions: [
          {
            id: "session-current",
            name: "Current Session",
            createdAt: Date.parse("2024-01-05T00:00:00Z"),
            isNewChat: false,
          },
        ],
        currentSessionId: "session-current",
        remoteSessionPaging: {
          isInitialLoading: false,
          isLoadingMore: false,
          hasMore: true,
          nextOffset: 25,
          pageSize: 25,
          hasLoadedInitialPage: true,
        },
      },
    });

    await store.dispatch(loadMoreSessionsFromStorage() as never);

    expect(listSessionFilesMock).toHaveBeenCalledWith({
      accessToken: "test-token",
      limit: 25,
      offset: 25,
    });

    const state = store.getState();
    expect(state.sessions.currentSessionId).toBe("session-current");
    expect(state.sessions.sessions.map((session) => session.id)).toEqual([
      "session-current",
      "session-oldest",
    ]);
    expect(state.sessions.remoteSessionPaging).toMatchObject({
      hasMore: false,
      nextOffset: 25,
      hasLoadedInitialPage: true,
      isLoadingMore: false,
    });
  });
});
