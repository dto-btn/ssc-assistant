import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
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

    expect(await screen.findByText("npm test")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "assistant.copy.code" })).not.toBeInTheDocument();
  });
});
