import { configureStore } from "@reduxjs/toolkit";
import { describe, expect, it, vi, beforeEach } from "vitest";
import sessionsReducer, { addSession, updateSessionActivity } from "../slices/sessionSlice";
import chatReducer, { addMessage, hydrateSessionMessages } from "../slices/chatSlice";
import sessionFilesReducer from "../slices/sessionFilesSlice";
import { bootstrapSessionsFromStorage } from "./sessionBootstrapThunks";
import { selectSessionLastActivityById, selectSessionsNewestFirst } from "../selectors/sessionSelectors";
import type { RootState } from "..";

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
          lastUpdated: "2026-05-09T10:00:00.000Z",
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
    expect(state.sessions.sessions.find((session) => session.id === "session-a")).toMatchObject({
      createdAt: Date.parse("2026-05-07T10:00:00.000Z"),
      updatedAt: Date.parse("2026-05-09T10:00:00.000Z"),
    });
    expect(selectSessionsNewestFirst(state as RootState).map((session) => session.id)).toEqual(["session-a", "session-b"]);
    expect(fetchFileDataUrlMock).not.toHaveBeenCalled();
  });

  it("refreshes cached session activity without changing its creation time or downloading messages", async () => {
    const store = makeStore();
    store.dispatch(addSession({ id: "cached", name: "Cached", createdAt: 100, isNewChat: false }));
    listSessionFilesMock.mockResolvedValue({
      files: [{
        blobName: "cached.chat.json",
        url: "/files/cached.chat.json",
        originalName: "cached.chat.json",
        sessionId: "cached",
        uploadedAt: "2026-05-07T10:00:00.000Z",
        lastUpdated: "2026-05-09T10:00:00.000Z",
      }],
      deletedSessionIds: [],
      sessionDeleted: false,
    });

    await store.dispatch(bootstrapSessionsFromStorage() as never);

    expect(store.getState().sessions.sessions[0]).toMatchObject({
      createdAt: 100,
      updatedAt: Date.parse("2026-05-09T10:00:00.000Z"),
    });
    expect(fetchFileDataUrlMock).not.toHaveBeenCalled();
  });

  it("keeps activity monotonic across new messages, hydration, and stale metadata", () => {
    const store = makeStore();
    store.dispatch(addSession({ id: "chat", name: "Chat", createdAt: 100, isNewChat: false }));
    store.dispatch(addMessage({ sessionId: "chat", role: "user", content: "Hello" }));
    const messageTime = store.getState().sessions.sessions[0].updatedAt!;
    expect(messageTime).toBeGreaterThan(100);
    store.dispatch(hydrateSessionMessages({
      sessionId: "chat",
      messages: [{ id: "restored", sessionId: "chat", role: "assistant", content: "Hi", timestamp: messageTime + 1000 }],
    }));
    store.dispatch(updateSessionActivity({ id: "chat", updatedAt: 200 }));
    expect(store.getState().sessions.sessions[0].updatedAt).toBe(messageTime + 1000);
  });

  it("supports cached sessions without updatedAt and newer loaded message timestamps", () => {
    const state = {
      sessions: { sessions: [
        { id: "old", name: "Old", createdAt: 100, isNewChat: false },
        { id: "new", name: "New", createdAt: 200, updatedAt: 300, isNewChat: false },
      ], currentSessionId: null },
      chat: { messages: [{ id: "message", sessionId: "old", timestamp: 400 }] },
    } as RootState;
    expect(selectSessionLastActivityById(state)).toEqual({ old: 400, new: 300 });
    expect(selectSessionsNewestFirst(state).map((session) => session.id)).toEqual(["old", "new"]);
  });
});