import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ChatMessages from "./ChatMessages";
import chatReducer from "../store/slices/chatSlice";
import sessionFilesReducer from "../store/slices/sessionFilesSlice";

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  return {
    ...actual,
    useTranslation: () => ({
      t: (key: string, options?: Record<string, unknown>) => {
        if (key === "assistant.waiting") {
          return "Assistant is thinking...";
        }
        if (key === "assistant.streaming") {
          return "Assistant is responding.";
        }
        if (key === "mcp.attribution.trigger") {
          return `MCP servers used for this response: ${options?.servers ?? "MCP server"}`;
        }
        if (key === "mcp.attribution.summary") {
          return `Tool: ${options?.primaryServer ?? "Tool server"}${options?.suffix ?? ""}`;
        }
        if (key === "mcp.attribution.unknown") {
          return "Tool server";
        }
        return (options?.defaultValue as string) ?? key;
      },
    }),
  };
});

type TestStoreState = {
  chat: ReturnType<typeof chatReducer>;
  sessionFiles: ReturnType<typeof sessionFilesReducer>;
};

function renderMessages(sessionId: string, preloadedState: TestStoreState) {
  const store = configureStore({
    reducer: {
      chat: chatReducer,
      sessionFiles: sessionFilesReducer,
    },
    preloadedState,
  });

  return render(
    <Provider store={store as never}>
      <ChatMessages sessionId={sessionId} />
    </Provider>
  );
}

describe("ChatMessages", () => {
  it("renders waiting status text as an aria-live status message", () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "",
            timestamp: 1,
          },
        ],
        isLoading: true,
        assistantResponsePhaseBySessionId: {
          s1: "waiting-first-token",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Assistant is thinking...");
    expect(screen.queryByText("Assistant is responding.")).not.toBeInTheDocument();
  });

  it("does not render helper status text while streaming", () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Hello there",
            timestamp: 1,
          },
        ],
        isLoading: true,
        assistantResponsePhaseBySessionId: {
          s1: "streaming",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(screen.queryByText("Assistant is responding.")).not.toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders mcp attribution chip for assistant responses with routing metadata", () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Routed answer",
            timestamp: 1,
            mcpAttribution: {
              source: "live",
              generatedAt: "2026-04-13T00:00:00.000Z",
              servers: [{ serverLabel: "geds-server" }],
            },
          },
        ],
        isLoading: false,
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(screen.getByRole("button", { name: /MCP servers used for this response/i })).toBeInTheDocument();
  });

  it("renders renumbered inline citations and citation chips for [docN] content", () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please see [doc2] and [doc1] for details.",
            timestamp: 1,
            citations: [
              { title: "Citation One", url: "https://example.com/one", content: "Excerpt one" },
              { title: "Citation Two", url: "https://example.com/two", content: "Excerpt two" },
            ],
          },
        ],
        isLoading: false,
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(screen.getByRole("link", { name: "1" })).toHaveAttribute("href", "https://example.com/one");
    expect(screen.getByRole("link", { name: "2" })).toHaveAttribute("href", "https://example.com/two");
    expect(screen.getByRole("link", { name: "Citation One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Citation Two" })).toBeInTheDocument();
  });

  it("opens the citation drawer from chip clicks and inline numbered links", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Reference text [doc1].",
            timestamp: 1,
            citations: [
              {
                title: "Citation One",
                url: "https://example.com/one",
                content: "Drawer excerpt one",
              },
            ],
          },
        ],
        isLoading: false,
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    await user.click(screen.getByRole("link", { name: "Citation One" }));
    expect(await screen.findByText("Drawer excerpt one")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "sidebar.close" }));
    await waitFor(() => {
      expect(screen.queryByText("Drawer excerpt one")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("link", { name: "1" }));
    expect(await screen.findByText("Drawer excerpt one")).toBeInTheDocument();
  });

  it("renders and opens annotation-style citations when response has no [docN] markers", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Alpha beta gamma.",
            timestamp: 1,
            citations: [
              {
                title: "Alpha Source",
                url: "https://example.com/alpha",
                content: "Alpha excerpt",
                endIndex: 5,
              },
            ],
          },
        ],
        isLoading: false,
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const inlineCitation = screen.getByRole("link", { name: "1" });
    expect(inlineCitation).toHaveAttribute("href", "https://example.com/alpha");
    expect(screen.getByRole("link", { name: "Alpha Source" })).toBeInTheDocument();

    await user.click(inlineCitation);
    expect(await screen.findByText("Alpha excerpt")).toBeInTheDocument();
  });

  it("shows source-like citation details in drawer instead of echoed answer text", async () => {
    const user = userEvent.setup();
    const answerText = "EPS is SSC's project system of record.";
    const sourceExcerpt = [
      "Project Management and Delivery Operating Guide",
      "Page 71 of 91",
      "F.1 Enterprise Portfolio System (EPS)",
      "Authoritative data source for all project data.",
    ].join("\n");

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: answerText,
            timestamp: 1,
            citations: [
              {
                title: "Project Management Operating Guide EN.pdf",
                url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
                content: answerText,
                endIndex: answerText.length,
              },
              {
                title: "Project Management Operating Guide EN.pdf",
                url: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
                content: sourceExcerpt,
                endIndex: answerText.length,
              },
            ],
          },
        ],
        isLoading: false,
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    await user.click(screen.getByRole("link", { name: "1" }));
    const pageMarkers = await screen.findAllByText(/Page 71 of 91/i);
    expect(pageMarkers.length).toBeGreaterThan(0);
    const sourceLines = screen.getAllByText(/Authoritative data source for all project data/i);
    expect(sourceLines.length).toBeGreaterThan(0);
  });
});
