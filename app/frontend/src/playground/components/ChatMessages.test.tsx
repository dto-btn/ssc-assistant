import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import ChatMessages from "./ChatMessages";
import chatReducer from "../store/slices/chatSlice";
import sessionFilesReducer from "../store/slices/sessionFilesSlice";

vi.mock("rehype-mermaid", () => ({
  default: () => (tree: any) => {
    const visit = (node: any, parent?: { children?: any[] }, index?: number) => {
      if (!node || typeof node !== "object") {
        return;
      }

      const className = Array.isArray(node.properties?.className)
        ? node.properties?.className.join(" ")
        : String(node.properties?.className || "");

      if (
        node.type === "element"
        && node.tagName === "code"
        && className.includes("language-mermaid")
        && parent
        && typeof index === "number"
        && Array.isArray(parent.children)
      ) {
        parent.children[index] = {
          type: "element",
          tagName: "div",
          properties: { className: ["mermaid"] },
          children: [
            {
              type: "element",
              tagName: "svg",
              properties: { id: "mermaid-test-diagram" },
              children: [],
            },
          ],
        };
        return;
      }

      if (!Array.isArray(node.children)) {
        return;
      }

      node.children.forEach((child: any, childIndex: number) => {
        if (child && typeof child === "object") {
          visit(child, node, childIndex);
        }
      });
    };

    visit(tree);
  },
}));

vi.mock("react-i18next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-i18next")>();
  const interpolate = (template: string, values?: Record<string, unknown>) => {
    if (!values) {
      return template;
    }

    return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key) => {
      const value = values[key.trim()];
      return value === undefined || value === null ? "" : String(value);
    });
  };

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
        if (typeof options?.defaultValue === "string") {
          return interpolate(options.defaultValue, options);
        }
        return key;
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

    expect(screen.getByRole("button", { name: "Open citation 1 details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open citation 2 details" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open citation details for Citation One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open citation details for Citation Two" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Open citation details for Citation One" }));
    expect(await screen.findByText("Drawer excerpt one")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open source in a new tab: https://example.com/one" })
    ).toHaveAttribute("href", "https://example.com/one");

    await user.click(screen.getByRole("button", { name: "Close citations" }));
    await waitFor(() => {
      expect(screen.queryByText("Drawer excerpt one")).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Open citation 1 details" }));
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

    const inlineCitation = screen.getByRole("button", { name: "Open citation 1 details" });
    expect(inlineCitation).toHaveAttribute("aria-haspopup", "dialog");
    expect(screen.getByRole("button", { name: "Open citation details for Alpha Source" })).toBeInTheDocument();

    await user.click(inlineCitation);
    expect(await screen.findByText("Alpha excerpt")).toBeInTheDocument();
  });

  it("keeps normal markdown links clickable when citation markers are placed after them", () => {
    const content = "See [SSC portal](https://example.com/portal) for details.";
    const linkTextEnd = content.indexOf("portal") + "portal".length;

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content,
            timestamp: 1,
            citations: [
              {
                title: "Portal Source",
                url: "https://example.com/portal",
                endIndex: linkTextEnd,
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

    expect(screen.getByRole("link", { name: "SSC portal" })).toHaveAttribute(
      "href",
      "https://example.com/portal",
    );
    expect(screen.getByRole("button", { name: "Open citation 1 details" })).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Open citation 1 details" }));
    const pageMarkers = await screen.findAllByText(/Page 71 of 91/i);
    expect(pageMarkers.length).toBeGreaterThan(0);
    const sourceLines = screen.getAllByText(/Authoritative data source for all project data/i);
    expect(sourceLines.length).toBeGreaterThan(0);
  });

  it("omits synthetic local citations from the rendered citation UI", () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please review [doc1].",
            timestamp: 1,
            citations: [
              {
                title: "local-citation://it-appears-that-the-search-d-uvdx2z",
                url: "local-citation://it-appears-that-the-search-d-uvdx2z",
                content: "Synthetic local reference content",
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

    expect(screen.queryByRole("button", { name: /local source reference/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open citation 1 details" })).not.toBeInTheDocument();
    expect(screen.getByText("Please review.")).toBeInTheDocument();
  });

  it("renders mermaid diagrams instead of leaving them as fenced code", async () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: [
              "```mermaid",
              "graph TD",
              "  Start[Start] --> Done[Done]",
              "```",
            ].join("\n"),
            timestamp: 1,
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

    await waitFor(() => {
      expect(
        document.querySelector(".mermaid svg, svg[id^='mermaid-']")
        || screen.queryByText("Invalid diagram format!")
      ).toBeTruthy();
    });

    expect(screen.queryByText(/graph TD/i)).not.toBeInTheDocument();
  });
});
