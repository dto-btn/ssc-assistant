export type FileCategory = "files" | "chat" | "archive" | string;

export interface FileAttachment {
  blobName: string;
  url: string;
  originalName: string;
  size?: number;
  contentType?: string | null;
  uploadedAt?: string | null;
  sessionId?: string | null;
  category?: FileCategory;
}
