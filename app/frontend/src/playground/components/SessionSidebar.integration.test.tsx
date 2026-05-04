import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const loadMoreSessionsFromStorageMock = vi.hoisted(() =>
  vi.fn(() => ({ type: "sessions/loadMoreMock" })),
);

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
    initReactI18next: {
      type: '3rdParty',
      init: vi.fn(),
    }
  };
});

import SessionSidebar from "./SessionSidebar";
import sessionReducer from "../store/slices/sessionSlice";
import uiReducer, { toggleSidebarCollapsed } from "../store/slices/uiSlice";

vi.mock("../store/thunks/sessionBootstrapThunks", () => ({
  loadMoreSessionsFromStorage: loadMoreSessionsFromStorageMock,
}));

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

const defaultRemoteSessionPaging = {
  isInitialLoading: false,
  isLoadingMore: false,
  hasMore: false,
  nextOffset: 0,
  pageSize: 25,
  hasLoadedInitialPage: false,
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
        remoteSessionPaging: defaultRemoteSessionPaging,
      },
      ui: {
        isSidebarCollapsed: true,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    // Check for "chats" header using the more specific heading role
    expect(screen.queryByRole("heading", { name: "chats" })).not.toBeInTheDocument();
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
        remoteSessionPaging: defaultRemoteSessionPaging,
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    expect(screen.getByRole("heading", { name: "chats" })).toBeInTheDocument();

    act(() => {
      store.dispatch(toggleSidebarCollapsed());
    });

    await waitFor(() => {
      expect(screen.queryByRole("heading", { name: "chats" })).not.toBeInTheDocument();
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
        remoteSessionPaging: defaultRemoteSessionPaging,
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
          remoteSessionPaging: defaultRemoteSessionPaging,
        },
        ui: {
          isSidebarCollapsed: false,
          isMobileSidebarOpen: true,
          isDeletingAllChats: false,
        },
      });

      await user.click(screen.getByRole("button", { name: "sidebar.close" }));

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
        remoteSessionPaging: defaultRemoteSessionPaging,
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: true,
        isDeletingAllChats: false,
      },
    });

    await user.click(screen.getByRole("button", { name: "sidebar.close" }));

    await waitFor(() => {
      expect((document.activeElement as HTMLElement | null)?.id).toBe("new-chat-button");
    });
  });

  it("shows a load-more control when more remote sessions are available", async () => {
    const user = userEvent.setup();

    renderSidebar(false, {
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
        remoteSessionPaging: {
          ...defaultRemoteSessionPaging,
          hasMore: true,
          nextOffset: 25,
          hasLoadedInitialPage: true,
        },
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    await user.click(screen.getByRole("button", { name: "sidebar.more" }));

    expect(loadMoreSessionsFromStorageMock).toHaveBeenCalledTimes(1);
  });

  it("shows a waiting label while more sessions are loading", () => {
    renderSidebar(false, {
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
        remoteSessionPaging: {
          ...defaultRemoteSessionPaging,
          hasMore: true,
          isLoadingMore: true,
          nextOffset: 25,
          hasLoadedInitialPage: true,
        },
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    expect(screen.getByRole("button", { name: "sidebar.loading.more" })).toHaveAttribute("aria-disabled", "true");
  });
});
