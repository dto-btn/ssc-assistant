export type FileCategory = "files" | "chat" | "archive" | string;

/**
 * Normalized attachment metadata shared between the UI and storage helpers.
 */
export interface FileAttachment {
  blobName: string;
  url: string;
  previewUrl?: string;
  originalName: string;
  size?: number;
  contentType?: string | null;
  uploadedAt?: string | null;
  sessionId?: string | null;
  category?: FileCategory;
  metadataType?: string;
  sessionName?: string | null;
  lastUpdated?: string | null;
}

/**
 * MCP Server configuration for the playground.
 */
export interface PlaygroundMCPServer {
  server_label: string;
  server_description: string;
  server_url: string;
  require_approval: "always" | "never";
  type: "mcp";
}
