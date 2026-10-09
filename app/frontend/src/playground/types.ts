export type FileCategory = "files" | "chat" | "archive" | string

/**
 * Normalized attachment metadata shared between the UI and storage helpers.
 */
export interface FileAttachment {
  blobName: string
  url: string
  previewUrl?: string
  originalName: string
  size?: number
  contentType?: string | null
  uploadedAt?: string | null
  sessionId?: string | null
  category?: FileCategory
  metadataType?: string
  sessionName?: string | null
  lastUpdated?: string | null
}

/** Feedback types and form structure shared between the UI and backend for chat feedback submissions. */
export type FeedbackType = "issue" | "suggestion" | "reaction" | string

export interface ChatFeedbackResponse {
  messageId: string
  sessionId: string
  type: FeedbackType
}

export type ChatFeedbackResponseReaction = ChatFeedbackResponse & {
  positive: boolean | null
  description?: string
}

export type BaseFeedbackForm = ChatFeedbackResponse & {
  description?: string
}

export type ChatFeedbackFormSubmission = BaseFeedbackForm & {
  stepsToReproduce?: string
  attachments?: FileAttachment[]
}
