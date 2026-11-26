import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useNavigate } from "react-router";
import MainScreen from "./index";
import { useAppStore } from "../../stores/AppStore";
import { useChatStore } from "../../stores/ChatStore";
import { buildDefaultChatHistory } from "../../stores/modelBuilders";
import i18n from "../../i18n";

vi.mock("@azure/msal-react", () => ({
  useMsal: () => ({ instance: {} }),
}));
vi.mock("../../components", () => ({
  ChatInput: () => null,
  Disclaimer: () => null,
  DrawerMenu: () => null,
  FeedbackForm: () => null,
  TopMenuHomePage: () => null,
}));
vi.mock("../../containers/ChatMessagesContainer", () => ({ default: () => null }));
vi.mock("../../components/DeleteConversationConfirmation", () => ({
  DeleteConversationConfirmation: () => null,
}));
vi.mock("../../components/layouts/NewLayout", () => ({ default: () => null }));
vi.mock("../../components/Suggestions", () => ({ default: () => null }));
vi.mock("../../hooks/useChatService", () => ({
  useChatService: () => ({ setCurrentChatIndex: useChatStore.getState().setCurrentChatIndex }),
}));
vi.mock("./useApiRequestService", () => ({
  useApiRequestService: () => ({ isLoading: false }),
}));

const context = {
  success: true,
  language: "en",
  original_query: "Same question",
  timestamp: "2026-11-09T12:00:00.000Z",
  requester: "mysscplus",
  content: "Answer",
  citations: [{ title: "Source", url: "https://example.com/source" }],
};
const handoff = (handoffId: string) => ({ handoffId, success: true, context });

function Navigation() {
  const navigate = useNavigate();
  return (
    <>
      <button onClick={() => navigate("/", { state: { suggestionHandoff: handoff("first") } })}>First</button>
      <button onClick={() => navigate("/", { state: { suggestionHandoff: handoff("second") } })}>Second</button>
    </>
  );
}

function setup(state: unknown) {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={[{ pathname: "/", state }]}>
        <Navigation />
        <MainScreen />
      </MemoryRouter>
    </StrictMode>,
  );
}

describe("legacy suggestion hand-off", () => {
  const showSnackbar = vi.fn();
  let originalShow: ReturnType<typeof useAppStore.getState>["snackbars"]["show"];

  beforeEach(() => {
    showSnackbar.mockClear();
    originalShow = useAppStore.getState().snackbars.show;
    act(() => {
      useAppStore.setState((state) => ({ snackbars: { ...state.snackbars, show: showSnackbar } }));
      useChatStore.getState().hydrateOnBoot({
        currentIndex: 0,
        currentHistory: buildDefaultChatHistory(),
        descriptions: ["Original"],
      });
    });
  });
  afterEach(() => {
    act(() => {
      useAppStore.setState((state) => ({ snackbars: { ...state.snackbars, show: originalShow } }));
    });
    vi.restoreAllMocks();
  });

  it("ignores unrelated navigation state", () => {
    setup({ success: true, context: null });
    expect(useChatStore.getState().chatHistoriesDescriptions).toEqual(["Original"]);
    expect(showSnackbar).not.toHaveBeenCalled();
  });

  it("reports an invalid hand-off without creating a conversation", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    setup({ suggestionHandoff: { success: true } });
    expect(useChatStore.getState().chatHistoriesDescriptions).toEqual(["Original"]);
    expect(showSnackbar).toHaveBeenCalledTimes(1);
    expect(showSnackbar).toHaveBeenCalledWith(
      i18n.t("playground:suggestion.errors.validation"),
      expect.anything(),
    );
  });

  it("imports distinct hand-offs with the same question only once each", () => {
    setup({ suggestionHandoff: handoff("first") });
    expect(useChatStore.getState().chatHistoriesDescriptions).toEqual(["Original", "Same question"]);
    fireEvent.click(screen.getByText("First"));
    expect(useChatStore.getState().chatHistoriesDescriptions).toHaveLength(2);
    fireEvent.click(screen.getByText("Second"));
    expect(useChatStore.getState().chatHistoriesDescriptions).toEqual(["Original", "Same question", "Same question"]);
    fireEvent.click(screen.getByText("First"));
    expect(useChatStore.getState().chatHistoriesDescriptions).toHaveLength(3);
    expect(showSnackbar).toHaveBeenCalledTimes(2);
  });

  it("retains the answer language on an imported completion", () => {
    setup({ suggestionHandoff: { ...handoff("french"), context: { ...context, language: "fr" } } });
    expect(useChatStore.getState().getCurrentChatHistory().chatItems[1]).toMatchObject({
      language: "fr",
      message: { content: expect.stringContaining(context.content) },
    });
    expect(showSnackbar).toHaveBeenCalledWith(
      i18n.t("playground:suggestion.opened"),
      undefined,
      "info",
    );
  });
});
