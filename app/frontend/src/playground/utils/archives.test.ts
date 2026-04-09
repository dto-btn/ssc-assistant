import { describe, expect, it } from "vitest";
import { normalizeArchiveMessage } from "./archives";

describe("normalizeArchiveMessage", () => {
  it("preserves valid mcpAttribution from archived assistant messages", () => {
    const restored = normalizeArchiveMessage(
      {
        id: "msg-1",
        role: "assistant",
        content: "hello",
        timestamp: 1710000000000,
        mcpAttribution: {
          source: "live",
          generatedAt: "2026-04-08T00:00:00.000Z",
          category: "geds",
          status: "done",
          statusMessage: "Completed",
          servers: [
            { serverLabel: "geds-server", serverUrl: "https://example.com/geds" },
          ],
        },
      },
      "session-1",
    );

    expect(restored).not.toBeNull();
    expect(restored?.mcpAttribution).toEqual({
      source: "live",
      generatedAt: "2026-04-08T00:00:00.000Z",
      category: "geds",
      status: "done",
      statusMessage: "Completed",
      servers: [
        { serverLabel: "geds-server", serverUrl: "https://example.com/geds" },
      ],
    });
  });

  it("drops malformed mcpAttribution payloads", () => {
    const restored = normalizeArchiveMessage(
      {
        id: "msg-2",
        role: "assistant",
        content: "hello",
        timestamp: 1710000001000,
        mcpAttribution: {
          source: "live",
          generatedAt: "2026-04-08T00:00:00.000Z",
          status: "done",
          servers: [{ serverUrl: "https://example.com/no-label" }],
        },
      },
      "session-1",
    );

    expect(restored).not.toBeNull();
    expect(restored?.mcpAttribution).toBeUndefined();
  });
});
