import { FileAttachment, FileCategory } from "../types";

const PLAYGROUND_API_BASE = "/api/playground";
const UPLOAD_ENDPOINT = `${PLAYGROUND_API_BASE}/upload`;
const FILES_FOR_SESSION_ENDPOINT = `${PLAYGROUND_API_BASE}/files-for-session`;
const EXTRACT_FILE_TEXT_ENDPOINT = `${PLAYGROUND_API_BASE}/extract-file-text`;

type MetadataRecord = Record<string, string | number | boolean | null | undefined>;

function extractMimeType(encoded: string | undefined): string | undefined {
  if (!encoded) return undefined;
  const match = /^data:([^;,]+)[;,]/i.exec(encoded);
  return match ? match[1] : undefined;
}

function normalizeMetadata(metadata?: MetadataRecord): Record<string, string> | undefined {
  if (!metadata) return undefined;
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) continue;
    result[key] = String(value);
  }
  return result;
}

function mapFilePayload(payload: any): FileAttachment {
  return {
    blobName: payload?.blobName ?? payload?.name ?? "",
    url: payload?.url ?? "",
    originalName: payload?.originalName ?? payload?.name ?? "",
    size: payload?.size,
    contentType: payload?.contentType ?? payload?.type ?? null,
    uploadedAt: payload?.uploadedAt ?? payload?.uploadedat ?? null,
    sessionId: payload?.sessionId ?? payload?.sessionid ?? null,
    category: payload?.category ?? undefined,
  };
}

async function handleJsonResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed (${response.status})`);
  }
  return response.json();
}

export interface UploadEncodedFileParams {
  encodedFile: string;
  originalName: string;
  accessToken: string;
  sessionId?: string;
  category?: FileCategory;
  mimeType?: string;
  metadata?: MetadataRecord;
}

export async function uploadEncodedFile({
  encodedFile,
  originalName,
  accessToken,
  sessionId,
  category,
  mimeType,
  metadata,
}: UploadEncodedFileParams): Promise<FileAttachment> {
  if (!encodedFile || !originalName) {
    throw new Error("encodedFile and originalName are required");
  }
  if (!accessToken?.trim()) {
    throw new Error("accessToken is required");
  }

  const payload: Record<string, unknown> = {
    encoded_file: encodedFile,
    name: originalName,
  };
  if (sessionId) payload.sessionId = sessionId;
  if (category) payload.category = category;
  const resolvedMime = mimeType || extractMimeType(encodedFile);
  if (resolvedMime) payload.fileType = resolvedMime;
  const normalizedMetadata = normalizeMetadata(metadata);
  if (normalizedMetadata && Object.keys(normalizedMetadata).length > 0) {
    payload.metadata = normalizedMetadata;
  }

  const response = await fetch(UPLOAD_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await handleJsonResponse(response);
  return mapFilePayload(data?.file);
}

export interface UploadFileParams {
  file: File;
  accessToken: string;
  sessionId?: string;
  category?: FileCategory;
  metadata?: MetadataRecord;
}

export async function uploadFile({
  file,
  accessToken,
  sessionId,
  category,
  metadata,
}: UploadFileParams): Promise<FileAttachment> {
  const reader = new FileReader();
  const dataUrl: string = await new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  return uploadEncodedFile({
    encodedFile: dataUrl,
    originalName: file.name,
    accessToken,
    sessionId,
    category,
    mimeType: file.type,
    metadata,
  });
}

export async function listSessionFiles({
  sessionId,
  accessToken,
}: {
  sessionId: string;
  accessToken: string;
}): Promise<FileAttachment[]> {
  if (!sessionId) throw new Error("sessionId is required");
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const response = await fetch(
    `${FILES_FOR_SESSION_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
      },
    },
  );

  const data = await handleJsonResponse(response);
  const files = Array.isArray(data?.files) ? data.files : [];
  return files.map(mapFilePayload);
}

export async function extractFileText({
  fileUrl,
  fileType,
}: {
  fileUrl: string;
  fileType?: string;
}): Promise<string> {
  if (!fileUrl) throw new Error("fileUrl is required");
  const response = await fetch(EXTRACT_FILE_TEXT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileUrl, fileType }),
  });
  const data = await handleJsonResponse(response);
  return data?.extractedText ?? "";
}
