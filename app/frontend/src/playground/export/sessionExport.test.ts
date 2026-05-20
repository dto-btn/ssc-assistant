import { describe, expect, it, beforeEach, vi } from "vitest";
import type { Message } from "../store/slices/chatSlice";
import type { FileAttachment } from "../types";
import {
  buildSessionExportDocument,
  buildSessionExportFileName,
  downloadSessionExportPdf,
  downloadSessionExportWord,
  extractMermaidDataRows,
  extractMermaidDiagrams,
} from "./sessionExport";

describe("sessionExport", () => {
  let capturedBlob: Blob | null = null;

  beforeEach(() => {
    capturedBlob = null;

    // Mock URL.createObjectURL to capture generated blobs
    const mockCreateObjectURL = vi.fn((blob: any) => {
      if (blob instanceof Blob) {
        capturedBlob = blob;
      }
      return `blob:mock-${Math.random()}`;
    });

    const mockRevokeObjectURL = vi.fn(() => {
      // No-op
    });

    vi.stubGlobal("URL", {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });
  });

  it("builds export payload with citation groups and attachment references", () => {
    const session = {
      id: "session-1",
      name: "My Session",
      createdAt: 100,
      isNewChat: false,
    };

    const attachment: FileAttachment = {
      blobName: "oid/files/session-1/image.png",
      originalName: "image.png",
      url: "https://example.com/blob/image.png",
      previewUrl: "/oid/files/session-1/image.png",
      contentType: "image/png",
      size: 42,
      uploadedAt: "2026-01-01T00:00:00.000Z",
      lastUpdated: "2026-01-01T00:00:01.000Z",
    };

    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "session-1",
        role: "assistant",
        content: "Answer [doc1]",
        timestamp: 10,
        citations: [
          {
            title: "Policy",
            url: "https://example.com/policy",
            content: "Policy content",
          },
        ],
        attachments: [attachment],
      },
    ];

    const payload = buildSessionExportDocument({
      session,
      messages,
      sessionFiles: [attachment],
      exportedAt: "2026-05-13T00:00:00.000Z",
    });

    expect(payload.version).toBe("1.0");
    expect(payload.session.name).toBe("My Session");
    expect(payload.messages).toHaveLength(1);
    expect(payload.messages[0].renderedContent).toContain("[1](<https://example.com/policy>)");
    expect(payload.messages[0].citationGroups).toHaveLength(1);
    expect(payload.messages[0].attachments).toHaveLength(1);
    expect(payload.messages[0].mermaidDiagrams).toHaveLength(0);
    expect(payload.messages[0].mermaidDataRows).toHaveLength(0);
    expect(payload.sessionAttachments).toHaveLength(1);
  });

  it("extracts Mermaid diagrams from fenced code blocks", () => {
    const diagrams = extractMermaidDiagrams([
      "Intro text",
      "```mermaid",
      "flowchart LR",
      "A --> B",
      "```",
      "mid text",
      "```mermaid",
      "sequenceDiagram",
      "Alice->>Bob: Hi",
      "```",
    ].join("\n"));

    expect(diagrams).toHaveLength(2);
    expect(diagrams[0].code).toContain("flowchart LR");
    expect(diagrams[1].code).toContain("sequenceDiagram");
  });

  it("extracts Mermaid data rows when structure repeats", () => {
    const rows = extractMermaidDataRows([
      "```mermaid",
      "flowchart LR",
      "A --> B",
      "B --> C",
      "```",
    ].join("\n"));

    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]).toMatchObject({
      type: "edge",
      source: "A",
      relation: "-->",
      target: "B",
    });
  });

  it("creates deterministic extension based on export format", () => {
    const jsonName = buildSessionExportFileName("Session Name", "json");
    const wordName = buildSessionExportFileName("Session Name", "word");

    expect(jsonName.endsWith(".json")).toBe(true);
    expect(wordName.endsWith(".docx")).toBe(true);
  });

  it("generates a valid PDF blob with expected content", async () => {
    const session = {
      id: "session-1",
      name: "PDF Test Session",
      createdAt: 100,
      isNewChat: false,
    };

    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "session-1",
        role: "user",
        content: "What is Lorem Ipsum?",
        timestamp: 10,
        citations: [],
        attachments: [],
      },
      {
        id: "m2",
        sessionId: "session-1",
        role: "assistant",
        content: "Lorem Ipsum is placeholder text. [doc1]",
        timestamp: 20,
        citations: [
          {
            title: "Wikipedia",
            url: "https://en.wikipedia.org/wiki/Lorem_ipsum",
            content: "Lorem ipsum dolor sit amet...",
          },
        ],
        attachments: [],
      },
    ];

    const exportDoc = buildSessionExportDocument({
      session,
      messages,
      sessionFiles: [],
      exportedAt: "2026-05-13T00:00:00.000Z",
    });

    await downloadSessionExportPdf("PDF Test Session", exportDoc);

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe("application/pdf");
    expect(capturedBlob!.size).toBeGreaterThan(0);

    // Verify PDF header signature by checking the first few bytes
    if (capturedBlob instanceof Blob && typeof capturedBlob.stream === "function") {
      const reader = capturedBlob.stream().getReader();
      const { value } = await reader.read();
      if (value) {
        const header = String.fromCharCode(value[0], value[1], value[2], value[3]);
        expect(header).toBe("%PDF");
      }
    } else {
      // Fallback: just verify the blob exists and is not empty
      expect(capturedBlob!.size).toBeGreaterThan(100); // PDF should be at least 100 bytes
    }
  });

  it("generates a valid Word (.docx) blob with expected structure", async () => {
    const session = {
      id: "session-2",
      name: "Word Test Session",
      createdAt: 200,
      isNewChat: false,
    };

    const messages: Message[] = [
      {
        id: "m1",
        sessionId: "session-2",
        role: "user",
        content: "# Heading\nTell me about this topic.",
        timestamp: 10,
        citations: [],
        attachments: [],
      },
      {
        id: "m2",
        sessionId: "session-2",
        role: "assistant",
        content: "Here is information:\n- Point 1\n- Point 2\n\n[source1]",
        timestamp: 20,
        citations: [
          {
            title: "Source Document",
            url: "https://example.com/source",
            content: "Content here",
          },
        ],
        attachments: [],
      },
    ];

    const exportDoc = buildSessionExportDocument({
      session,
      messages,
      sessionFiles: [],
      exportedAt: "2026-05-13T00:00:00.000Z",
    });

    await downloadSessionExportWord("Word Test Session", exportDoc);

    expect(capturedBlob).not.toBeNull();
    expect(capturedBlob!.type).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(capturedBlob!.size).toBeGreaterThan(0);

    // Verify DOCX file structure (should be a ZIP file starting with PK)
    if (capturedBlob instanceof Blob && typeof capturedBlob.stream === "function") {
      const reader = capturedBlob.stream().getReader();
      const { value } = await reader.read();
      if (value) {
        const zipSignature = String.fromCharCode(value[0], value[1]);
        expect(zipSignature).toBe("PK"); // ZIP file signature
      }
    } else {
      // Fallback: just verify the blob is reasonably sized (docx files are typically > 1KB)
      expect(capturedBlob!.size).toBeGreaterThan(500);
    }
  });
});
