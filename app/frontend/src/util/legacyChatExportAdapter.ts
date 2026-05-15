import { transformToBusinessRequest } from "./bits_utils";
import { isACompletion, isAMessage } from "../utils";
import type { FileAttachment } from "../playground/types";
import type { Message as PlaygroundMessage } from "../playground/store/slices/chatSlice";
import type { Session } from "../playground/store/slices/sessionSlice";
import {
  buildSessionExportDocument,
  type SessionExportAttachment,
  type SessionExportDocument,
} from "../playground/export/sessionExport";

interface BuildLegacyExportResult {
  sessionName: string;
  document: SessionExportDocument;
}

const toTimestamp = (createdAt: unknown, index: number): number => {
  const parsed = new Date(typeof createdAt === "string" || typeof createdAt === "number" ? createdAt : "");
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.getTime() + index * 1000;
  }

  return Date.now() + index * 1000;
};

const normalizeAttachment = (attachment: Attachment): FileAttachment => {
  const source = attachment.blob_storage_url || "";
  const fileName = attachment.file_name || source.split("/").pop() || "attachment";
  return {
    blobName: source,
    url: source,
    previewUrl: source,
    originalName: fileName,
    contentType: attachment.type || null,
    size: undefined,
  };
};

const extractBrArtifacts = (toolsInfo?: ToolInfo[]): PlaygroundMessage["brArtifacts"] | undefined => {
  if (!Array.isArray(toolsInfo) || toolsInfo.length === 0) {
    return undefined;
  }

  let brData: Record<string, unknown>[] | undefined;
  let brMetadata: Record<string, unknown> | undefined;
  let brQuery: Record<string, unknown> | undefined;
  let brSelectFields: { fields: string[] } | undefined;

  toolsInfo.forEach((tool) => {
    const payload = tool?.payload;
    if (!payload || typeof payload !== "object") {
      return;
    }

    if (Array.isArray(payload.br) && payload.br.length > 0) {
      try {
        brData = (payload.br as Record<string, unknown>[]).map((row) => transformToBusinessRequest(row));
      } catch {
        brData = payload.br as Record<string, unknown>[];
      }
    }

    if (payload.metadata && typeof payload.metadata === "object") {
      brMetadata = payload.metadata as Record<string, unknown>;
    }

    if (payload.brquery && typeof payload.brquery === "object") {
      brQuery = payload.brquery as Record<string, unknown>;
    }

    if (
      payload.brselect
      && typeof payload.brselect === "object"
      && Array.isArray((payload.brselect as { fields?: unknown[] }).fields)
    ) {
      brSelectFields = {
        fields: ((payload.brselect as { fields: unknown[] }).fields || [])
          .map((field) => String(field)),
      };
    }
  });

  if (!brData && !brMetadata && !brQuery && !brSelectFields) {
    return undefined;
  }

  return {
    brData,
    brMetadata,
    brQuery,
    brSelectFields,
  };
};

const completionToMessage = (
  completion: Completion,
  sessionId: string,
  index: number,
  createdAt: unknown,
): PlaygroundMessage => {
  const assistantMessage = completion.message;
  const normalizedAttachments = (assistantMessage.attachments || []).map(normalizeAttachment);

  return {
    id: `legacy-assistant-${index}`,
    sessionId,
    role: assistantMessage.role || "assistant",
    content: assistantMessage.content || "",
    timestamp: toTimestamp(createdAt, index),
    citations: assistantMessage.context?.citations,
    attachments: normalizedAttachments,
    brArtifacts: extractBrArtifacts(assistantMessage.tools_info),
  };
};

const userToMessage = (
  message: Message,
  sessionId: string,
  index: number,
  createdAt: unknown,
): PlaygroundMessage => {
  const normalizedAttachments = (message.attachments || []).map(normalizeAttachment);

  return {
    id: `legacy-user-${index}`,
    sessionId,
    role: message.role,
    content: message.content || "",
    timestamp: toTimestamp(createdAt, index),
    attachments: normalizedAttachments,
  };
};

const dedupeSessionAttachments = (messages: PlaygroundMessage[]): FileAttachment[] => {
  const byKey = new Map<string, FileAttachment>();

  messages.forEach((message) => {
    (message.attachments || []).forEach((attachment) => {
      const key = `${attachment.blobName}|${attachment.url}|${attachment.originalName}`;
      byKey.set(key, attachment);
    });
  });

  return Array.from(byKey.values());
};

export const buildLegacySessionExportDocument = (
  chatHistory: ChatHistory,
  currentChatIndex: number,
): BuildLegacyExportResult => {
  const sessionId = chatHistory.uuid || `legacy-chat-${currentChatIndex + 1}`;
  const sessionName = chatHistory.description || `Conversation ${currentChatIndex + 1}`;
  const session: Session = {
    id: sessionId,
    name: sessionName,
    createdAt: toTimestamp((chatHistory as { createdAt?: unknown }).createdAt, 0),
    staticTools: chatHistory.staticTools,
    isNewChat: false,
  };

  const messages: PlaygroundMessage[] = [];

  chatHistory.chatItems.forEach((chatItem, index) => {
    if (isAMessage(chatItem)) {
      messages.push(userToMessage(chatItem, sessionId, index, (chatHistory as { createdAt?: unknown }).createdAt));
      return;
    }

    if (isACompletion(chatItem)) {
      messages.push(completionToMessage(chatItem, sessionId, index, (chatHistory as { createdAt?: unknown }).createdAt));
    }
  });

  const sessionFiles = dedupeSessionAttachments(messages);

  return {
    sessionName,
    document: buildSessionExportDocument({
      session,
      messages,
      sessionFiles,
    }),
  };
};

export const resolveLegacyAttachmentData = async (
  attachment: SessionExportAttachment,
): Promise<{ bytes: Uint8Array; contentType: string } | null> => {
  if (!attachment.url) {
    return null;
  }

  try {
    const response = await fetch(attachment.url);
    if (!response.ok) {
      return null;
    }

    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      bytes,
      contentType: attachment.contentType || response.headers.get("content-type") || "application/octet-stream",
    };
  } catch {
    return null;
  }
};
