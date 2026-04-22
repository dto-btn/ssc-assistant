import { describe, expect, it } from "vitest";

import {
  extractCitationsFromPayload,
  extractResponseCitations,
  groupCitationsByUrl,
  mergeCitations,
  processTextWithCitations,
  type Citation,
} from "./citations";

describe("processTextWithCitations", () => {
  it("renumbers legacy [docN] references into sequential markdown links", () => {
    const citations: Citation[] = [
      { title: "Doc One", url: "https://example.com/doc one" },
      { title: "Doc Two", url: "https://example.com/doc-two" },
      { title: "Doc Three", url: "https://example.com/doc-three" },
    ];

    const result = processTextWithCitations(
      "First [doc1], then [doc3].",
      citations,
    );

    expect(result.processedText).toContain("[1](<https://example.com/doc%20one>)");
    expect(result.processedText).toContain("[2](<https://example.com/doc-three>)");
    expect(result.processedText).not.toContain("[doc1]");
    expect(result.citedCitations).toEqual([citations[0], citations[2]]);
    expect(result.citationNumberMapping).toEqual({ 1: 1, 3: 2 });
  });

  it("inserts numbered links for annotation citations when no [docN] markers exist", () => {
    const text = "Alpha beta gamma.";
    const citations: Citation[] = [
      {
        title: "Alpha Source",
        url: "https://example.com/source-a",
        endIndex: 5,
      },
      {
        title: "Gamma Source",
        url: "https://example.com/source-b",
        endIndex: 10,
      },
    ];

    const result = processTextWithCitations(text, citations);

    expect(result.processedText).toContain("[1](<https://example.com/source-a>)");
    expect(result.processedText).toContain("[2](<https://example.com/source-b>)");
    expect(result.citedCitations).toEqual(citations);
    expect(result.citationNumberMapping).toEqual({ 1: 1, 2: 2 });
  });

  it("assigns unique numbers for annotation citations even when URLs repeat", () => {
    const text = "Alpha. Beta.";
    const citations: Citation[] = [
      {
        title: "Shared Source",
        url: "https://example.com/shared",
        endIndex: 6,
      },
      {
        title: "Shared Source",
        url: "https://example.com/shared",
        endIndex: 12,
      },
    ];

    const result = processTextWithCitations(text, citations);

    expect(result.processedText).toContain("[1](<https://example.com/shared>)");
    expect(result.processedText).toContain("[2](<https://example.com/shared>)");
    expect(result.citationNumberMapping).toEqual({ 1: 1, 2: 2 });
  });

  it("uses sentence-level inline insertion when no positions can be inferred", () => {
    const text = "EPS helps project governance. It supports planning and delivery.";
    const citations: Citation[] = [
      { title: "EPS Guide.pdf", url: "/pmcoe/en/eps-guide.pdf" },
      { title: "Delivery Manual.pdf", url: "/pmcoe/en/delivery-manual.pdf" },
    ];

    const result = processTextWithCitations(text, citations);

    expect(result.processedText).toContain("governance. [1](</pmcoe/en/eps-guide.pdf>)");
    expect(result.processedText).toContain("delivery. [2](</pmcoe/en/delivery-manual.pdf>)");
    expect(result.processedText).not.toContain("\n\n[1]");
  });
});

describe("groupCitationsByUrl", () => {
  it("groups duplicate urls and keeps the smallest display number", () => {
    const citationA1: Citation = {
      title: "Policy A",
      url: "https://example.com/policy-a",
      content: "chunk 1",
    };
    const citationA2: Citation = {
      title: "Policy A",
      url: "https://example.com/policy-a",
      content: "chunk 2",
    };
    const citationB: Citation = {
      title: "Policy B",
      url: "https://example.com/policy-b",
      content: "chunk b",
    };

    const allCitations = [citationA1, citationA2, citationB];
    const groups = groupCitationsByUrl(
      [citationA1, citationA2, citationB],
      allCitations,
      { 1: 2, 2: 3, 3: 1 },
    );

    expect(groups).toHaveLength(2);
    expect(groups[0].url).toBe("https://example.com/policy-b");
    expect(groups[0].displayNumber).toBe(1);
    expect(groups[1].url).toBe("https://example.com/policy-a");
    expect(groups[1].citations).toHaveLength(2);
    expect(groups[1].displayNumber).toBe(2);
  });
});

describe("extractResponseCitations", () => {
  it("extracts url_citation annotations from responses output", () => {
    const citations = extractResponseCitations({
      output: [
        {
          content: [
            {
              annotations: [
                {
                  type: "url_citation",
                  title: "Source A",
                  url: "https://example.com/a",
                  text: "Excerpt A",
                  start_index: 2,
                  end_index: 12,
                },
                {
                  type: "not_a_citation",
                  title: "Ignore",
                  url: "https://example.com/ignore",
                },
              ],
            },
          ],
        },
      ],
    });

    expect(citations).toEqual([
      {
        title: "Source A",
        url: "https://example.com/a",
        content: "Excerpt A",
        startIndex: 2,
        endIndex: 12,
      },
    ]);
  });
});

describe("extractCitationsFromPayload", () => {
  it("extracts citation annotations from stream-style event payloads", () => {
    const citations = extractCitationsFromPayload({
      type: "response.output_text.annotation.added",
      annotation: {
        type: "url_citation",
        title: "Stream Source",
        url: "https://example.com/stream-source",
        text: "stream excerpt",
        start_index: 4,
        end_index: 20,
      },
    });

    expect(citations).toEqual([
      {
        title: "Stream Source",
        url: "https://example.com/stream-source",
        content: "stream excerpt",
        startIndex: 4,
        endIndex: 20,
      },
    ]);
  });

  it("extracts citation-like entries from MCP payloads in citations arrays", () => {
    const citations = extractCitationsFromPayload({
      type: "response.mcp_call.completed",
      result: {
        citations: [
          {
            title: "EPS Guide",
            url: "https://example.com/eps-guide",
            content: "EPS citation excerpt",
          },
        ],
      },
    });

    expect(citations).toEqual([
      {
        title: "EPS Guide",
        url: "https://example.com/eps-guide",
        content: "EPS citation excerpt",
        startIndex: undefined,
        endIndex: undefined,
      },
    ]);
  });

  it("keeps citations when URL is missing by generating a local synthetic citation URL", () => {
    const citations = extractCitationsFromPayload({
      type: "response.mcp_call.completed",
      result: {
        citations: [
          {
            title: "EPS Guide.pdf",
            content: "EPS citation excerpt",
          },
        ],
      },
    });

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe("EPS Guide.pdf");
    expect(citations[0].url).toMatch(/^local-citation:\/\/eps-guide-pdf-[a-z0-9]+$/);
    expect(citations[0].url).not.toContain("#citation-");
  });

  it("creates distinct synthetic URLs for missing-url citations with same title", () => {
    const citations = extractCitationsFromPayload({
      result: {
        citations: [
          {
            title: "Policy Overview",
            content: "First excerpt with one detail.",
          },
          {
            title: "Policy Overview",
            content: "Second excerpt with another detail.",
          },
        ],
      },
    });

    expect(citations).toHaveLength(2);
    expect(citations[0].url).not.toBe(citations[1].url);
  });

  it("extracts citations from JSON-string payload fields", () => {
    const citations = extractCitationsFromPayload({
      type: "response.mcp_call.completed",
      result: JSON.stringify({
        citations: [
          {
            title: "JSON Citation",
            url: "https://example.com/json-citation",
            content: "json excerpt",
          },
        ],
      }),
    });

    expect(citations).toEqual([
      {
        title: "JSON Citation",
        url: "https://example.com/json-citation",
        content: "json excerpt",
        startIndex: undefined,
        endIndex: undefined,
      },
    ]);
  });

  it("filters out metadata noise entries like query/doc id while keeping real citations", () => {
    const citations = extractCitationsFromPayload({
      result: {
        citations: [
          { title: "query", content: "EPS guidance" },
          { title: "Doc id", content: "123456" },
          { title: "management-operating-guide-en-pdf", content: "Meaningful excerpt from source document." },
        ],
      },
    });

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe("management-operating-guide-en-pdf");
  });

  it("extracts source_path + article/page metadata into rich citation details", () => {
    const citations = extractCitationsFromPayload({
      result: {
        citations: [
          {
            file_name: "Project Management Operating Guide EN.pdf",
            source_path: "/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf",
            article: "F.1 Enterprise Portfolio System (EPS) is SSC's system of record.",
            page_number: 71,
          },
        ],
      },
    });

    expect(citations).toHaveLength(1);
    expect(citations[0].title).toBe("Project Management Operating Guide EN.pdf");
    expect(citations[0].url).toBe("/pmcoe-sept-2025/en/Project Management Operating Guide EN.pdf");
    expect(citations[0].content).toContain("Page 71");
    expect(citations[0].content).toContain("F.1 Enterprise Portfolio System");
  });
});

describe("mergeCitations", () => {
  it("deduplicates citations across response/event extraction passes", () => {
    const merged = mergeCitations(
      [
        {
          title: "A",
          url: "https://example.com/a",
          content: "same",
          startIndex: 1,
          endIndex: 2,
        },
      ],
      [
        {
          title: "A",
          url: "https://example.com/a",
          content: "same",
          startIndex: 1,
          endIndex: 2,
        },
      ],
    );

    expect(merged).toHaveLength(1);
  });
});