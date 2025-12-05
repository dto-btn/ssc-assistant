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

export interface TokenUsageMetrics {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model?: string;
  provider?: string;
  timestamp?: number;
}
