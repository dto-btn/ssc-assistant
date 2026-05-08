import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("react-use-measure", () => ({
  default: () => [vi.fn(), { height: 500 }],
}));

import SessionSidebar from "./SessionSidebar";
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
  sessions: ReturnType<typeof sessionReducer>;
  ui: ReturnType<typeof uiReducer>;
};

/**
 * Creates a minimal Redux harness for rendering SessionSidebar in isolation.
 */
function renderSidebar(isMobile: boolean, preloadedState?: TestStoreState) {
  const store = configureStore({
    reducer: {
      sessions: sessionReducer,
      ui: uiReducer,
    },
    preloadedState,
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

    store.dispatch(toggleSidebarCollapsed());

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

    await user.click(screen.getByRole("button", { name: "Session 2" }));

    await waitFor(() => {
      expect(store.getState().ui.isMobileSidebarOpen).toBe(false);
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
});
