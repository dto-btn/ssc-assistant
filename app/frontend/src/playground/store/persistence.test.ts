import { beforeEach, describe, expect, it } from "vitest";

import { loadChatState } from "./persistence";

/**
 * Verifies persistence migration keeps durable preferences and resets transient UI state.
 */
describe("playground persistence migration", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("hydrates sidebar collapse preference and resets transient mobile drawer state", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({
        chat: { messages: [], isLoading: false },
        ui: { isSidebarCollapsed: true, isMobileSidebarOpen: true },
      })
    );

    const state = loadChatState() as {
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.ui.isSidebarCollapsed).toBe(true);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });

  it("defaults ui state when missing in legacy payload", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({ chat: { messages: [] } })
    );

    const state = loadChatState() as {
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.ui.isSidebarCollapsed).toBe(false);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });

  it("returns undefined for malformed JSON payloads", () => {
    localStorage.setItem("playground_chat_state", "{bad-json");

    const state = loadChatState();

    expect(state).toBeUndefined();
  });

  it("migrates invalid legacy branches to safe defaults", () => {
    localStorage.setItem(
      "playground_chat_state",
      JSON.stringify({
        chat: { messages: {}, isLoading: "yes" },
        ui: { isSidebarCollapsed: "no", isMobileSidebarOpen: true },
      })
    );

    const state = loadChatState() as {
      chat: { messages: unknown[]; isLoading: boolean };
      ui: { isSidebarCollapsed: boolean; isMobileSidebarOpen: boolean };
    };

    expect(state.chat.messages).toEqual([]);
    expect(state.chat.isLoading).toBe(false);
    expect(state.ui.isSidebarCollapsed).toBe(false);
    expect(state.ui.isMobileSidebarOpen).toBe(false);
  });
});
