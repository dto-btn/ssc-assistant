/**
 * URL validation tests that protect MCP onboarding constraints introduced in
 * the orchestrator routing work.
 */

import { describe, expect, it } from "vitest";

import { isValidMcpUrl } from "./toolSlice";

/**
 * Unit tests for MCP endpoint URL validation guardrails.
 */
describe("isValidMcpUrl", () => {
  it("accepts https MCP endpoint", () => {
    expect(isValidMcpUrl("https://example.com/mcp")).toBe(true);
  });

  it("accepts https MCP endpoint with trailing slash", () => {
    expect(isValidMcpUrl("https://example.com/mcp/")).toBe(true);
  });

  it("rejects endpoints without MCP path", () => {
    expect(isValidMcpUrl("https://example.com/api")).toBe(false);
  });
});
