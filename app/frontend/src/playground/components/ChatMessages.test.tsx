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
  const interpolate = (
    template: string,
    options?: Record<string, unknown>
  ): string => {
    if (!options) {
      return template;
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      const value = options[key];
      return value === undefined ? `{{${key}}}` : String(value);
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

        const defaultValue = (options?.defaultValue as string | undefined) ?? key;
        return interpolate(defaultValue, options);
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

  const renderResult = render(
    <Provider store={store as never}>
      <ChatMessages sessionId={sessionId} />
    </Provider>
  );

  return {
    ...renderResult,
    store,
  };
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
        isLoadingBySessionId: { s1: true },
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
        isLoadingBySessionId: { s1: true },
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
        isLoadingBySessionId: {},
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

  it("renders GFM tables in assistant markdown content", async () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "| Name | Value |\n| --- | --- |\n| Speed | Fast |",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Name" })).toHaveAttribute("scope", "col");
    expect(screen.getByText("Speed")).toBeInTheDocument();
    expect(screen.getByText("Fast")).toBeInTheDocument();
  });

  it("keeps code block copy action available for assistant markdown", async () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "```ts\nconst total = 42;\n```",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(await screen.findByRole("button", { name: "assistant.copy.code" })).toBeInTheDocument();
  });

  it("renders inline code without block copy controls", async () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Use `npm test` to run checks.",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(await screen.findByText("npm test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "assistant.copy.code" })).not.toBeInTheDocument();
  });

  it("does not render user mermaid markdown as a diagram", async () => {
    const { container } = renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "user",
            content: "```mermaid\ngraph TD\n  A-->B\n```",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(await screen.findByText(/graph TD/)).toBeInTheDocument();
    expect(container.querySelector("svg[id^='mermaid-']")).toBeNull();
    expect(screen.queryByRole("button", { name: "assistant.mermaid.viewCode" })).not.toBeInTheDocument();
  });

  it("shows mermaid toggle for assistant messages and switches labels on click", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "```mermaid\ngraph TD\n  A-->B\n```",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const toggleButton = await screen.findByRole("button", { name: "assistant.mermaid.viewCode" });
    expect(toggleButton).toHaveAttribute("aria-pressed", "false");

    await user.click(toggleButton);
    expect(screen.getByRole("button", { name: "assistant.mermaid.viewDiagram" })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps a single mermaid toggle after rerender with unchanged state", async () => {
    const view = renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "```mermaid\ngraph TD\n  A-->B\n```",
            timestamp: 1,
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    expect(await screen.findByRole("button", { name: "assistant.mermaid.viewCode" })).toBeInTheDocument();

    view.rerender(
      <Provider store={view.store as never}>
        <ChatMessages sessionId="s1" />
      </Provider>
    );

    expect(screen.getAllByRole("button", { name: "assistant.mermaid.viewCode" })).toHaveLength(1);
  });

  it("opens the citation drawer when an inline citation number is clicked", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please review [doc1] for the policy details.",
            timestamp: 1,
            citations: [
              {
                title: "Policy Guide.pdf",
                url: "https://example.com/policy guide.pdf",
                content: "Policy guide excerpt.",
              },
            ],
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const citationButton = await screen.findByRole("button", {
      name: "Open citation 1 details",
    });

    await user.click(citationButton);

    const dialog = await screen.findByRole("dialog", { name: "Citations" });

    expect(dialog).toHaveTextContent("Policy Guide.pdf");
  });

  it("uses the citation number to open the drawer even when the inline href does not match the source url", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please review [1](https://example.com/mismatched-link) for the policy details.",
            timestamp: 1,
            citations: [
              {
                title: "Policy Guide.pdf",
                url: "https://example.com/policy guide.pdf",
                content: "Policy guide excerpt.",
              },
            ],
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const citationButton = await screen.findByRole("button", {
      name: "Open citation 1 details",
    });

    expect(screen.queryByRole("link", { name: "1" })).not.toBeInTheDocument();

    await user.click(citationButton);

    const dialog = await screen.findByRole("dialog", { name: "Citations" });

    expect(dialog).toHaveTextContent("Policy Guide.pdf");
  });

  it("renders multiple distinct inline citations as drawer-opening buttons", async () => {
    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please review [doc1] and [doc2] for the policy details.",
            timestamp: 1,
            citations: [
              {
                title: "Policy Guide.pdf",
                url: "https://example.com/policy-guide.pdf",
                content: "Policy guide excerpt.",
              },
              {
                title: "Procedure Manual.pdf",
                url: "https://example.com/procedure-manual.pdf",
                content: "Procedure manual excerpt.",
              },
            ],
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const firstCitationButton = await screen.findByRole("button", {
      name: "Open citation 1 details",
    });
    const secondCitationButton = await screen.findByRole("button", {
      name: "Open citation 2 details",
    });

    expect(screen.queryByRole("link", { name: "1" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "2" })).not.toBeInTheDocument();
    expect(firstCitationButton).toBeInTheDocument();
    expect(secondCitationButton).toBeInTheDocument();
  });

  it("renders later explicit inline citation links as drawer-opening buttons even when they share the same source url", async () => {
    const user = userEvent.setup();

    renderMessages("s1", {
      chat: {
        messages: [
          {
            id: "m1",
            sessionId: "s1",
            role: "assistant",
            content: "Please review [1](https://example.com/shared.pdf) and [2](https://example.com/shared.pdf).",
            timestamp: 1,
            citations: [
              {
                title: "Shared Source.pdf",
                url: "https://example.com/shared.pdf",
                content: "First shared excerpt.",
              },
              {
                title: "Shared Source.pdf",
                url: "https://example.com/shared.pdf",
                content: "Second shared excerpt.",
              },
            ],
          },
        ],
        isLoadingBySessionId: {},
        assistantResponsePhaseBySessionId: {
          s1: "idle",
        },
        orchestratorInsightsBySessionId: {},
      },
      sessionFiles: {
        bySessionId: {},
      },
    });

    const citationButtons = await screen.findAllByRole("button", {
      name: "Open citation 2 details",
    });

    expect(screen.queryByRole("link", { name: "2" })).not.toBeInTheDocument();

    expect(citationButtons).toHaveLength(1);

    await user.click(citationButtons[0]);

    const dialog = await screen.findByRole("dialog", { name: "Citations" });

    expect(dialog).toHaveTextContent("Shared Source.pdf");
    expect(dialog).toHaveTextContent("Second shared excerpt.");
  });
});
