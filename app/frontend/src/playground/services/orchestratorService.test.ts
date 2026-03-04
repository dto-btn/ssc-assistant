import { describe, expect, it } from "vitest";

import { normalizeHttpsMcpUrl } from "./orchestratorService";

describe("normalizeHttpsMcpUrl", () => {
  it("keeps https MCP paths intact", () => {
    const result = normalizeHttpsMcpUrl("https://example.com/mcp");
    expect(result.pathname).toBe("/mcp");
  });

  it("normalizes trailing slash to a single /mcp", () => {
    const result = normalizeHttpsMcpUrl("https://example.com/mcp/");
    expect(result.pathname).toBe("/mcp");
  });

  it("appends /mcp when missing", () => {
    const result = normalizeHttpsMcpUrl("https://example.com/api");
    expect(result.pathname).toBe("/api/mcp");
  });
});
