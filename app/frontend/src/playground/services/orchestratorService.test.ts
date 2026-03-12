/**
 * Regression tests for orchestrator URL normalization and recommendation
 * resolution behavior in the orchestrator-routing flow.
 */

import { describe, expect, it } from "vitest";

import type { OrchestratorInsights } from "../store/slices/chatSlice";
import { normalizeHttpsMcpUrl, resolveServersFromInsights } from "./orchestratorService";

/**
 * Unit tests for URL normalization and confidence-based server resolution.
 */
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

describe("resolveServersFromInsights confidence threshold", () => {
  const server = {
    type: "mcp" as const,
    server_label: "geds_mcp",
    server_description: "Directory lookup",
    server_url: "https://geds.example.ca/mcp",
    require_approval: "never" as const,
  };

  const baseInsights: OrchestratorInsights = {
    category: "directory",
    recommendations: [],
    source: "orchestrator",
    timestamp: new Date().toISOString(),
  };

  it("keeps recommendations at or above default 40%", () => {
    const insights: OrchestratorInsights = {
      ...baseInsights,
      recommendations: [
        {
          mcp_server_id: "geds_mcp",
          endpoint: "https://geds.example.ca/mcp",
          confidence: 0.39,
        },
        {
          mcp_server_id: "geds_mcp",
          endpoint: "https://geds.example.ca/mcp",
          confidence: 0.4,
        },
      ],
    };

    const resolved = resolveServersFromInsights(insights, [server]);
    expect(resolved).toHaveLength(1);
  });

  it("accepts percent-style confidence values from orchestrator", () => {
    const insights: OrchestratorInsights = {
      ...baseInsights,
      recommendations: [
        {
          mcp_server_id: "geds_mcp",
          endpoint: "https://geds.example.ca/mcp",
          confidence: 39,
        },
        {
          mcp_server_id: "geds_mcp",
          endpoint: "https://geds.example.ca/mcp",
          confidence: 87,
        },
      ],
    };

    const resolved = resolveServersFromInsights(insights, [server]);
    expect(resolved).toHaveLength(1);
  });
});
