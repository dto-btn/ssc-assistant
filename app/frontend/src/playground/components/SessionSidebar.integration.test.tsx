import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-use-measure", () => ({
  default: () => [vi.fn(), { height: 500 }],
}));

import SessionSidebar from "./SessionSidebar";
import chatReducer from "../store/slices/chatSlice";
import sessionReducer from "../store/slices/sessionSlice";
import uiReducer, { toggleSidebarCollapsed } from "../store/slices/uiSlice";

vi.mock("./SessionRenameDialog", () => ({
  default: () => null,
}));

vi.mock("./SyncStatusIndicator", () => ({
  default: () => null,
}));

vi.mock("./ProfileMenu/ProfileMenu", () => ({
  default: () => null,
}));

type TestStoreState = {
  chat: ReturnType<typeof chatReducer>;
  sessions: ReturnType<typeof sessionReducer>;
  ui: ReturnType<typeof uiReducer>;
};

/**
 * Creates a minimal Redux harness for rendering SessionSidebar in isolation.
 */
function renderSidebar(isMobile: boolean, preloadedState?: TestStoreState) {
  const defaultState: TestStoreState = {
    chat: {
      messages: [],
      isLoadingBySessionId: {},
      assistantResponsePhaseBySessionId: {},
      orchestratorInsightsBySessionId: {},
    },
    sessions: {
      sessions: [],
      currentSessionId: null,
    },
    ui: {
      isSidebarCollapsed: false,
      isMobileSidebarOpen: false,
      isDeletingAllChats: false,
    },
  };

  const store = configureStore({
    reducer: {
      chat: chatReducer,
      sessions: sessionReducer,
      ui: uiReducer,
    },
    preloadedState: {
      ...defaultState,
      ...preloadedState,
      chat: {
        ...defaultState.chat,
        ...(preloadedState?.chat ?? {}),
      },
      sessions: {
        ...defaultState.sessions,
        ...(preloadedState?.sessions ?? {}),
      },
      ui: {
        ...defaultState.ui,
        ...(preloadedState?.ui ?? {}),
      },
    },
  });

  render(
    <Provider store={store as never}>
      <SessionSidebar isMobile={isMobile} />
    </Provider>
  );

  return store;
}

describe("SessionSidebar responsive behavior", () => {
  /**
   * Test that the "chats" section heading is hidden when the desktop sidebar
   * is in a collapsed state.
   */
  it("hides desktop sidebar when collapsed", () => {
    renderSidebar(false, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [],
        currentSessionId: null,
      },
      ui: {
        isSidebarCollapsed: true,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    // Check for "chats" header using the more specific heading role
    expect(screen.queryByRole("heading", { name: "Chats" })).not.toBeInTheDocument();
  });

  /**
   * Integration test verifying that dispatching a sidebar collapse action correctly
   * updates the UI to show or hide the sidebar content.
   */
  it("reacts to sidebar collapse state change", async () => {
    const store = renderSidebar(false, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [],
        currentSessionId: null,
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    expect(screen.getByRole("heading", { name: "Chats" })).toBeInTheDocument();

    act(() => {
      store.dispatch(toggleSidebarCollapsed());
    });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "Chats" })).not.toBeInTheDocument();
    });
  });

  /**
   * Test that the mobile drawer/sidebar automatically closes after a user
   * selects a chat session from the list (improves mobile UX flow).
   */
  it("closes mobile drawer after selecting a session", async () => {
    const user = userEvent.setup();

    const store = renderSidebar(true, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [
          {
            id: "s1",
            name: "Session 1",
            createdAt: 1,
            isNewChat: false,
          },
          {
            id: "s2",
            name: "Session 2",
            createdAt: 2,
            isNewChat: false,
          },
        ],
        currentSessionId: "s1",
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: true,
        isDeletingAllChats: false,
      },
    });

    const session2Item = screen.getByRole("listitem", { name: "Session 2" });
    const session2Button = within(session2Item).getByRole("button", { name: /Session 2/i });
    await user.click(session2Button);

    await waitFor(() => {
      expect(store.getState().ui.isMobileSidebarOpen).toBe(false);
    });
  });

  it("renders virtualized session options with native list semantics", () => {
    renderSidebar(false, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [
          {
            id: "s1",
            name: "Session 1",
            createdAt: 1,
            isNewChat: false,
          },
          {
            id: "s2",
            name: "Session 2",
            createdAt: 2,
            isNewChat: false,
          },
        ],
        currentSessionId: "s1",
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    const sessionList = screen.getByRole("list", { name: "Chats" });
    expect(within(sessionList).getAllByRole("listitem")).toHaveLength(2);
  });

  it("supports keyboard navigation and selection across the virtualized list", async () => {
    const user = userEvent.setup();

    const store = renderSidebar(false, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [
          {
            id: "s1",
            name: "Session 1",
            createdAt: 1,
            isNewChat: false,
          },
          {
            id: "s2",
            name: "Session 2",
            createdAt: 2,
            isNewChat: false,
          },
          {
            id: "s3",
            name: "Session 3",
            createdAt: 3,
            isNewChat: false,
          },
        ],
        currentSessionId: "s3",
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    const sessionList = screen.getByRole("list", { name: "Chats" });
    sessionList.focus();

    expect(sessionList).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{ArrowDown}");

    expect(sessionList).not.toHaveAttribute("aria-activedescendant");

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(store.getState().sessions.currentSessionId).toBe("s2");
    });
  });

  /**
   * Test that closing the mobile drawer returns focus to the trigger element
   * (e.g., the open button in the TopBar). This is critical for keyboard and
   * screen reader accessibility (WCAG 2.4.3).
   */
  it("returns focus to opener when mobile drawer closes", async () => {
    const user = userEvent.setup();

    // Simulate the chat-area toggle button so focus restoration can be asserted.
    const opener = document.createElement("button");
    opener.id = "playground-open-sidebar-button";
    opener.textContent = "open";
    document.body.appendChild(opener);

    try {
      renderSidebar(true, {
        chat: {
          messages: [],
          isLoadingBySessionId: {},
          assistantResponsePhaseBySessionId: {},
          orchestratorInsightsBySessionId: {},
        },
        sessions: {
          sessions: [
            {
              id: "s1",
              name: "Session 1",
              createdAt: 1,
              isNewChat: false,
            },
          ],
          currentSessionId: "s1",
        },
        ui: {
          isSidebarCollapsed: false,
          isMobileSidebarOpen: true,
          isDeletingAllChats: false,
        },
      });

      await user.click(screen.getByRole("button", { name: "Close chat sessions" }));

      await waitFor(() => {
        expect(document.activeElement).toBe(opener);
      });
    } finally {
      opener.remove();
    }
  });

  it("falls back to new chat button focus when opener is absent", async () => {
    const user = userEvent.setup();

    renderSidebar(true, {
      chat: {
        messages: [],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {},
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [
          {
            id: "s1",
            name: "Session 1",
            createdAt: 1,
            isNewChat: false,
          },
        ],
        currentSessionId: "s1",
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: true,
        isDeletingAllChats: false,
      },
    });

    await user.click(screen.getByRole("button", { name: "Close chat sessions" }));

    await waitFor(() => {
      expect((document.activeElement as HTMLElement | null)?.id).toBe("new-chat-button");
    });
  });

  it("marks waiting sessions in the title attributes", () => {
    renderSidebar(false, {
      chat: {
        messages: [],
        isLoadingBySessionId: { s1: true },
        assistantResponsePhaseBySessionId: { s2: "drafting" },
        orchestratorInsightsBySessionId: {},
      },
      sessions: {
        sessions: [
          {
            id: "s1",
            name: "Session 1",
            createdAt: 1,
            isNewChat: false,
          },
          {
            id: "s2",
            name: "Session 2",
            createdAt: 2,
            isNewChat: false,
          },
          {
            id: "s3",
            name: "Session 3",
            createdAt: 3,
            isNewChat: false,
          },
        ],
        currentSessionId: "s3",
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    expect(screen.getByTestId("session-title-s1")).toHaveAttribute("data-waiting-for-response", "true");
    expect(screen.getByTestId("session-title-s2")).toHaveAttribute("data-waiting-for-response", "true");
    expect(screen.getByTestId("session-title-s3")).toHaveAttribute("data-waiting-for-response", "false");

    expect(document.getElementById("session-button-s1")).toHaveAttribute(
      "aria-describedby",
      "session-waiting-status-s1"
    );
    expect(document.getElementById("session-button-s2")).toHaveAttribute(
      "aria-describedby",
      "session-waiting-status-s2"
    );
    expect(document.getElementById("session-button-s3")).not.toHaveAttribute("aria-describedby");

    expect(document.getElementById("session-waiting-status-s1")).toHaveTextContent("Waiting for AI response");
    expect(document.getElementById("session-waiting-status-s2")).toHaveTextContent("Waiting for AI response");
  });
});
