import { StrictMode } from "react";
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router";
import { SuggestCallbackRoute } from "./SuggestCallbackRoute";
import { rootReducer } from "../playground/store";
import NewConversationOnOpen from "../playground/components/NewConversationOnOpen";
import ToastContainer from "../playground/components/ToastContainer";
import ChatMessages from "../playground/components/ChatMessages";
import { useAppSelector } from "../playground/store/hooks";
import { addSession } from "../playground/store/slices/sessionSlice";
import { loadChatState } from "../playground/store/persistence";
import { getSuggestionContext } from "../api/suggestionContext.api";
import i18n from "../i18n";

const context = {
  success: true,
  language: "en",
  original_query: "What is SSC's content management system?",
  timestamp: "2026-11-09T12:00:00.000Z",
  requester: "mysscplus",
  content: "The saved answer [doc1].",
  citations: [
    { title: "First source", url: "https://example.com/first" },
    { title: "Additional source", url: "https://example.com/additional" },
  ],
};

function ChatDestination() {
  const sessionId = useAppSelector((state) => state.sessions.currentSessionId);
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <NewConversationOnOpen />
      <ToastContainer />
      {sessionId && <ChatMessages sessionId={sessionId} />}
      <output data-testid="location">{JSON.stringify({
        pathname: location.pathname,
        state: location.state,
      })}</output>
      <button onClick={() => navigate("/playground", {
        state: { suggestionHandoff: { success: true } },
      })}>Invalid hand-off</button>
    </>
  );
}

function setup(initialEntry: string | { pathname: string; state: unknown } =
  "/suggest-callback?suggestionContextId=saved-id") {
  const store = configureStore({ reducer: rootReducer });
  store.dispatch(addSession({
    id: "existing",
    name: "Existing conversation",
    createdAt: 1,
    isNewChat: false,
  }));
  const result = render(
    <StrictMode>
      <Provider store={store}>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/suggest-callback" element={<SuggestCallbackRoute />} />
            <Route path="*" element={<ChatDestination />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    </StrictMode>,
  );
  return { store, ...result };
}

describe("suggest callback to playground", () => {
  beforeEach(async () => {
    localStorage.clear();
    vi.stubEnv("VITE_PLAYGROUND_ON", "true");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await i18n.changeLanguage("en");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const respondWith = (body: unknown) =>
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      }),
    ));

  it("imports, renders native citations, and consumes state once under Strict Mode", async () => {
    respondWith(context);
    const { store, rerender } = setup();
    await screen.findByText(/^The saved answer/, {}, { timeout: 5000 });
    expect(await screen.findByText(context.original_query)).toBeVisible();
    expect(screen.getByRole("button", { name: /First source/ })).toBeVisible();
    expect(screen.getByRole("button", { name: /Additional source/ })).toBeVisible();
    expect(store.getState().sessions.sessions).toHaveLength(2);
    expect(store.getState().chat.messages).toHaveLength(2);
    await waitFor(() => {
      expect(screen.getByTestId("location")).not.toHaveTextContent("suggestionHandoff");
    });
    expect(screen.getByTestId("location")).toHaveTextContent("suggestionSessionId");
    expect(loadChatState()).toMatchObject({
      chat: { messages: store.getState().chat.messages },
    });
    rerender(
      <StrictMode>
        <Provider store={store}>
          <MemoryRouter><ChatDestination /></MemoryRouter>
        </Provider>
      </StrictMode>,
    );
    expect(store.getState().chat.messages).toHaveLength(2);
  });

  it("respects the French answer language", async () => {
    respondWith({ ...context, language: "fr" });
    setup();
    await screen.findByText(/^The saved answer/, {}, { timeout: 5000 });
    expect(i18n.language).toBe("fr");
    expect(screen.getByRole("button", { name: /First source/ })).toBeVisible();
  });

  for (const language of ["en", "fr"]) {
    it.each([
      ["missing", "suggestion.errors.missing"],
      ["server", "suggestion.errors.server"],
      ["validation", "suggestion.errors.validation"],
      ["network", "suggestion.errors.unknown"],
    ])(`shows the %s error in ${language} without modifying history`, async (kind, key) => {
      await i18n.changeLanguage(language);
      if (kind === "network") {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
      } else {
        respondWith(kind === "server" ? { success: false } : { success: true });
      }
      const { store } = setup(kind === "missing"
        ? "/suggest-callback"
        : "/suggest-callback?suggestionContextId=saved-id");
      expect(await screen.findByRole("alert")).toHaveTextContent(
        i18n.t(`playground:${key}`, { lng: language }),
      );
      expect(store.getState().sessions.currentSessionId).toBe("existing");
      expect(store.getState().sessions.sessions).toHaveLength(1);
      expect(store.getState().chat.messages).toHaveLength(0);
      expect(store.getState().toast.toasts).toHaveLength(1);
      if (kind === "missing") expect(fetch).not.toHaveBeenCalled();
    });
  }

  it("validates malformed navigation state", async () => {
    setup({ pathname: "/playground", state: {
      otherState: "preserved",
      suggestionHandoff: { success: true },
    } });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      i18n.t("playground:suggestion.errors.validation"),
    );
    expect(screen.getByTestId("location")).toHaveTextContent("preserved");
  });

  it("restores an imported session after reload without another API request", async () => {
    respondWith(context);
    const { store, unmount } = setup();
    await screen.findByText(/^The saved answer/, {}, { timeout: 5000 });
    const sessionId = store.getState().sessions.currentSessionId;
    const reloadedStore = configureStore({
      reducer: rootReducer,
      preloadedState: { ...store.getState(), ...loadChatState() },
    });
    unmount();
    vi.mocked(fetch).mockClear();
    render(
      <Provider store={reloadedStore}>
        <MemoryRouter initialEntries={[{
          pathname: "/playground",
          state: { suggestionSessionId: sessionId },
        }]}>
          <ChatDestination />
        </MemoryRouter>
      </Provider>,
    );
    await screen.findByText(/^The saved answer/, {}, { timeout: 5000 });
    expect(reloadedStore.getState().sessions.currentSessionId).toBe(sessionId);
    expect(reloadedStore.getState().chat.messages).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("does not navigate after a request resolves following unmount", async () => {
    let resolveResponse!: (response: Response) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    })));
    const { store, unmount } = setup();
    unmount();
    await act(async () => {
      resolveResponse(new Response(JSON.stringify(context)));
    });
    expect(store.getState().chat.messages).toHaveLength(0);
  });

  it("URL-encodes suggestion identifiers in the API client", async () => {
    respondWith(context);
    await getSuggestionContext({ suggestionContextId: "id&extra=value" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/1.0/suggest?suggestionContextId=id%26extra%3Dvalue",
      expect.any(Object),
    );
  });

  it("keeps the home destination available when the playground is disabled", async () => {
    vi.stubEnv("VITE_PLAYGROUND_ON", "false");
    respondWith(context);
    setup();
    await screen.findByText(/^The saved answer/, {}, { timeout: 5000 });
    expect(screen.getByTestId("location")).toHaveTextContent('"pathname":"/"');
  });
});
