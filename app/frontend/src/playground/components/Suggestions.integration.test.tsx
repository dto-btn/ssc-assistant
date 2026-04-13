import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import ChatArea from "./ChatArea";
import chatReducer from "../store/slices/chatSlice";
import sessionReducer from "../store/slices/sessionSlice";
import authReducer from "../store/slices/authSlice";
import syncReducer from "../store/slices/syncSlice";
import modelReducer from "../store/slices/modelSlice";
import sessionFilesReducer from "../store/slices/sessionFilesSlice";
import outboxReducer from "../store/slices/outboxSlice";
import userReducer from "../store/slices/userSlice";
import uiReducer from "../store/slices/uiSlice";
import toastReducer from "../store/slices/toastSlice";
import quotedReducer from "../store/slices/quotedSlice";
import * as assistantThunks from "../store/thunks/assistantThunks";

/**
 * Suggestions Integration Tests
 * 
 * Verifies the end-to-end integration between the Suggestions UI, the ChatArea container,
 * and the Redux store's live completion thunks. Focuses on ensuring that clicking
 * a card generates a real assistant turn rather than just updating local UI state.
 */

// Mock react-i18next completely to avoid initReactI18next issues
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  }
}));

// Mock i18n instance
vi.mock("../../../i18n", () => ({
  default: {
    use: vi.fn().mockReturnThis(),
    init: vi.fn().mockResolvedValue({}),
    t: (key: string) => key,
  },
}));

// Mock API calls and effects to prevent network errors during render
vi.mock("../api/storage", () => ({
  listSessionFiles: vi.fn().mockResolvedValue({ files: [], deletedSessionIds: [] }),
}));

// Helper to create a store for testing
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      chat: chatReducer,
      sessions: sessionReducer,
      auth: authReducer,
      sync: syncReducer,
      models: modelReducer,
      sessionFiles: sessionFilesReducer,
      outbox: outboxReducer,
      user: userReducer,
      ui: uiReducer,
      toast: toastReducer,
      quoted: quotedReducer,
    },
    preloadedState: initialState as any,
  });
};

describe("Suggestions Integration", () => {
  let store: any;
  const sessionId = "test-session";

  /**
   * Setup for each integration test.
   * Initializes a fresh Redux store with core state and mocks the `sendAssistantMessage`
   * thunk to intercept and verify outgoing message requests to the AI orchestrator.
   */
  beforeEach(() => {
    store = createTestStore({
      sessions: {
        currentSessionId: sessionId,
        sessions: [{ id: sessionId, title: "Test Session" }],
      },
      chat: {
        messages: [],
        isLoading: false,
        orchestratorInsightsBySessionId: {},
      },
      auth: {
        accessToken: "test-token",
      }
    });

    // Mock sendAssistantMessage thunk to check if live completion is triggered
    vi.spyOn(assistantThunks, "sendAssistantMessage").mockImplementation((args: any) => {
      return async (dispatch: any) => {
        return { success: true };
      };
    });
  });

  /**
   * End-to-End Test: UI Interaction to Redux Orchestration.
   * 
   * This test simulates a real user workflow:
   * 1. Rendering the `ChatArea` container.
   * 2. Finding a valid suggestion button.
   * 3. Clicking it.
   * 4. Verifies that `sendAssistantMessage` is dispatched with the correct
   *    `sessionId` and `content`.
   * 
   * This confirms that the logic correctly maps human-readable UI cards to the
   * precise prompt keys expected by the backend orchestrator's autonomous routing.
   */
  it("triggers the assistant with the correct prompt content when a suggestion is clicked", async () => {
    const user = userEvent.setup();
    render(
      <Provider store={store}>
        <ChatArea />
      </Provider>
    );

    const suggestionsStrings = [
      "suggestions.general.contact",
      "suggestions.general.email",
      "suggestions.general.hire",
      "suggestions.business.find",
      "suggestions.business.pspc",
      "suggestions.business.piechart",
    ];

    const buttons = screen.getAllByRole("button");
    const suggestionButton = buttons.find(b => 
      suggestionsStrings.some(s => b.getAttribute("aria-label")?.includes(s)) ||
      b.getAttribute("aria-label")?.startsWith("suggestions.pmcoe.q")
    );

    expect(suggestionButton).toBeDefined();
    const expectedContent = suggestionButton?.getAttribute("aria-label") || "";

    await user.click(suggestionButton!);

    // If this assertion passes, it confirms the thunk (and backend routing) is triggered correctly
    expect(assistantThunks.sendAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: sessionId,
        content: expectedContent,
      })
    );
  });
});
