import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { describe, expect, it, beforeEach, vi } from "vitest";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock("./ChatMessages", () => ({
  default: () => <div data-testid="chat-messages" />,
}));

vi.mock("./ChatInput", () => ({
  default: () => <div data-testid="chat-input" />,
}));

vi.mock("./Suggestions", () => ({
  default: () => <div data-testid="suggestions" />,
}));

vi.mock("./OrchestratorDebugPanel", () => ({
  default: () => <div data-testid="orchestrator-debug" />,
}));

vi.mock("./TopBar", () => ({
  default: () => <div data-testid="top-bar" />,
}));

vi.mock("../api/storage", () => ({
  listSessionFiles: vi.fn(),
}));

vi.mock("../store/thunks/sessionBootstrapThunks", () => ({
  rehydrateSessionFromArchive: vi.fn((sessionId: string) => async () => ({
    restored: false,
    hasArchive: false,
    latestVersion: null,
    sessionId,
  })),
}));

vi.mock("../store/thunks/sessionManagementThunks", () => ({
  applyRemoteSessionDeletion: vi.fn(() => ({ type: "mock/applyRemoteSessionDeletion" })),
}));

vi.mock("../store/thunks/assistantThunks", () => ({
  sendAssistantMessage: vi.fn(() => ({ type: "mock/sendAssistantMessage" })),
}));

import ChatArea from "./ChatArea";
import chatReducer from "../store/slices/chatSlice";
import sessionReducer from "../store/slices/sessionSlice";
import sessionFilesReducer from "../store/slices/sessionFilesSlice";
import syncReducer from "../store/slices/syncSlice";
import uiReducer from "../store/slices/uiSlice";
import { listSessionFiles } from "../api/storage";

const theme = createTheme();
const listSessionFilesMock = vi.mocked(listSessionFiles);

type RenderOptions = {
  accessToken: string | null;
};

function renderChatArea({ accessToken }: RenderOptions) {
  const authReducer = (state = { accessToken }) => state;

  const store = configureStore({
    reducer: {
      auth: authReducer,
      chat: chatReducer,
      sessionFiles: sessionFilesReducer,
      sessions: sessionReducer,
      sync: syncReducer,
      ui: uiReducer,
    },
    preloadedState: {
      auth: { accessToken },
      chat: {
        ...chatReducer(undefined, { type: "@@INIT" }),
        messages: [],
      },
      sessionFiles: sessionFilesReducer(undefined, { type: "@@INIT" }),
      sessions: {
        ...sessionReducer(undefined, { type: "@@INIT" }),
        currentSessionId: "session-1",
        sessions: [
          {
            id: "session-1",
            name: "Archived chat",
            createdAt: 1,
            isNewChat: false,
          },
        ],
      },
      sync: syncReducer(undefined, { type: "@@INIT" }),
      ui: uiReducer(undefined, { type: "@@INIT" }),
    },
  });

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <ChatArea />
      </ThemeProvider>
    </Provider>
  );
}

describe("ChatArea hydration state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listSessionFilesMock.mockResolvedValue({
      files: [],
      deletedSessionIds: [],
      sessionDeleted: false,
    });
  });

  it("does not show the restoring loader before auth is available", async () => {
    renderChatArea({ accessToken: null });

    await waitFor(() => {
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });

  it("stops showing the restoring loader when rehydration resolves without an archive", async () => {
    renderChatArea({ accessToken: "token" });

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveAttribute("aria-atomic", "true");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent("Restoring chat history...");
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("suggestions")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input")).toBeInTheDocument();
  });
});