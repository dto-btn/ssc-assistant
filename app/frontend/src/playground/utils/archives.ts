/**
 * Archive utility helpers shared between components and thunks.
 */

import type { FileAttachment } from "../types";
import type { Message } from "../store/slices/chatSlice";

export function isChatArchiveAttachment(file: FileAttachment): boolean {
  const metadataType = file.metadataType?.toLowerCase();
  if (metadataType === "chat-archive") {
    return true;
  }
  const category = file.category?.toLowerCase();
  if (category !== "chat") {
    return false;
  }
  const name = file.originalName || file.blobName;
  return typeof name === "string" && name.endsWith(".chat.json");
}

export function pickLatestArchive(files?: FileAttachment[] | null): FileAttachment | undefined {
  if (!Array.isArray(files) || files.length === 0) {
    return undefined;
  }
  return [...files].sort((a, b) => {
    const aSource = a.lastUpdated || a.uploadedAt;
    const bSource = b.lastUpdated || b.uploadedAt;
    const aTime = aSource ? Date.parse(aSource) : 0;
    const bTime = bSource ? Date.parse(bSource) : 0;
    return bTime - aTime;
  })[0];
}

export function decodeArchiveDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

export function normalizeArchiveMessage(candidate: unknown, sessionId: string): Message | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;

  const rawRole = (record.role ?? record.author ?? record.type) as unknown;
  let role: Message["role"] | null = null;
  if (rawRole === "assistant" || rawRole === "system") {
    role = rawRole;
  } else if (rawRole === "user" || rawRole === "human" || rawRole === "client") {
    role = "user";
  } else if (rawRole === "bot" || rawRole === "assistant_bot") {
    role = "assistant";
  }
  if (!role) {
    return null;
  }

  const possibleContent = [
    record.content,
    record.text,
    record.body,
    typeof record.message === "string" ? record.message : undefined,
  ];
  const content = possibleContent.find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );
  if (!content) {
    return null;
  }

  const rawTimestamp = record.timestamp;
  let timestamp: number;
  if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    timestamp = rawTimestamp;
  } else if (typeof rawTimestamp === "string") {
    const parsed = Date.parse(rawTimestamp);
    timestamp = Number.isNaN(parsed) ? Date.now() : parsed;
  } else {
    timestamp = Date.now();
  }

  const id =
    typeof record.id === "string" && record.id
      ? record.id
      : typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `restored-${sessionId}-${timestamp}-${Math.random().toString(36).slice(2)}`;

  const attachments = Array.isArray(record.attachments)
    ? (record.attachments as Message["attachments"])
    : undefined;
  const citations = Array.isArray(record.citations)
    ? (record.citations as Message["citations"])
    : undefined;

  return {
    id,
    sessionId,
    role,
    content,
    timestamp,
    attachments,
    citations,
  };
}
