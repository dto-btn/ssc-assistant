import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import SessionSidebar from "./SessionSidebar";
import sessionReducer from "../store/slices/sessionSlice";
import uiReducer from "../store/slices/uiSlice";

/**
 * Integration tests for responsive sidebar behavior (desktop collapse and mobile drawer UX).
 */
vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string) => key,
    }),
  };
});

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

    expect(screen.queryByText("chats")).not.toBeInTheDocument();
  });

  it("collapses desktop sidebar from toggle control", async () => {
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
      },
      ui: {
        isSidebarCollapsed: false,
        isMobileSidebarOpen: false,
        isDeletingAllChats: false,
      },
    });

    await user.click(screen.getByRole("button", { name: "sidebar.collapse" }));

    await waitFor(() => {
      expect(screen.queryByText("chats")).not.toBeInTheDocument();
    });
  });

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
});
