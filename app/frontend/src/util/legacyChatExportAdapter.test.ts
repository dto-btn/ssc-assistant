import { describe, expect, it } from "vitest";
import { buildLegacySessionExportDocument } from "./legacyChatExportAdapter";

describe("legacyChatExportAdapter", () => {
  it("maps legacy chat history into export document with Mermaid and BR rows", () => {
    const history: ChatHistory = {
      description: "Legacy Conversation",
      uuid: "legacy-123",
      model: "gpt-4o",
      isTopicSet: true,
      staticTools: [],
      chatItems: [
        {
          role: "user",
          content: "show me the flow",
          attachments: [
            {
              blob_storage_url: "https://example.com/files/doc.png",
              file_name: "doc.png",
              type: "image/png",
              message: "ok",
            },
          ],
        },
        {
          message: {
            role: "assistant",
            content: [
              "```mermaid",
              "flowchart LR",
              "A --> B",
              "B --> C",
              "```",
            ].join("\n"),
            context: {
              role: "assistant",
              intent: [],
              citations: [
                {
                  title: "Reference",
                  url: "https://example.com/ref",
                  content: "reference content",
                  metadata: { chunking: "none" },
                },
              ],
            },
            tools_info: [
              {
                tool_type: "bits",
                function_name: "search",
                payload: {
                  br: [
                    {
                      BR_NMBR: "BR-1",
                      STATUS: "Active",
                    },
                    {
                      BR_NMBR: "BR-2",
                      STATUS: "Closed",
                    },
                  ],
                },
              },
            ],
          },
        },
      ],
    };

    const result = buildLegacySessionExportDocument(history, 0);

    expect(result.sessionName).toBe("Legacy Conversation");
    expect(result.document.session.id).toBe("legacy-123");
    expect(result.document.messages).toHaveLength(2);
    expect(result.document.messages[1].mermaidDiagrams.length).toBeGreaterThan(0);
    expect(result.document.messages[1].mermaidDataRows.length).toBeGreaterThan(0);
    expect(result.document.messages[1].citationGroups).toHaveLength(1);
    expect(result.document.sessionAttachments.length).toBe(1);
  });
});
