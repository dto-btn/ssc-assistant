import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import McpAttributionPill from "./McpAttributionPill";
import type { MessageMcpAttribution } from "../store/slices/chatSlice";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      switch (key) {
        case "mcp.attribution.unknown":
          return "Tool server";
        case "mcp.attribution.summary":
          return `Tool: ${options?.primaryServer ?? "Tool server"}${options?.suffix ?? ""}`;
        case "mcp.attribution.trigger":
          return `MCP servers used for this response: ${options?.servers ?? "MCP server"}`;
        case "mcp.attribution.title":
          return "MCP attribution";
        case "mcp.attribution.description":
          return "This response used the following MCP server.";
        case "mcp.attribution.category":
          return `Category: ${options?.category ?? ""}`;
        case "mcp.attribution.status":
          return `Status: ${options?.status ?? ""}`;
        default:
          return key;
      }
    },
  }),
}));

const sampleAttribution: MessageMcpAttribution = {
  source: "live",
  generatedAt: "2026-04-08T00:00:00.000Z",
  category: "geds",
  status: "done",
  statusMessage: "Completed",
  servers: [
    { serverLabel: "geds-server", serverUrl: "https://example.com/geds" },
    { serverLabel: "pmcoe-server", serverUrl: "https://example.com/pmcoe" },
  ],
};

describe("McpAttributionPill", () => {
  it("renders compact summary label", () => {
    render(<McpAttributionPill attribution={sampleAttribution} messageId="msg-1" />);

    expect(screen.getByText("Tool: geds-server +1")).toBeInTheDocument();
  });

  it("opens details on click and shows server list", async () => {
    const user = userEvent.setup();
    render(<McpAttributionPill attribution={sampleAttribution} messageId="msg-2" />);

    await user.click(screen.getByText("Tool: geds-server +1"));

    expect(screen.getByText("MCP attribution")).toBeInTheDocument();
    expect(screen.getByText("geds-server")).toBeInTheDocument();
    expect(screen.getByText("pmcoe-server")).toBeInTheDocument();
    expect(screen.getByText("Category: geds")).toBeInTheDocument();
    expect(screen.getByText("Status: done - Completed")).toBeInTheDocument();
  });

  it("supports keyboard interaction and closes on escape", async () => {
    const user = userEvent.setup();
    render(<McpAttributionPill attribution={sampleAttribution} messageId="msg-3" />);

    const trigger = screen.getByRole("button", {
      name: "MCP servers used for this response: geds-server, pmcoe-server",
    });

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByText("MCP attribution")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByText("MCP attribution")).not.toBeInTheDocument();
  });
});
