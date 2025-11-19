import { FileAttachment, FileCategory } from "../types";

const PLAYGROUND_API_BASE = "/api/playground";
const UPLOAD_ENDPOINT = `${PLAYGROUND_API_BASE}/upload`;
const FILES_FOR_SESSION_ENDPOINT = `${PLAYGROUND_API_BASE}/files-for-session`;
const EXTRACT_FILE_TEXT_ENDPOINT = `${PLAYGROUND_API_BASE}/extract-file-text`;
const sessionDeleteEndpoint = (sessionId: string) => `${PLAYGROUND_API_BASE}/sessions/${encodeURIComponent(sessionId)}`;

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

type RawFilePayload = Record<string, unknown> & {
  blobName?: string;
  name?: string;
  originalName?: string;
  url?: string;
  size?: number;
  contentType?: string;
  type?: string;
  uploadedAt?: string;
  uploadedat?: string;
  sessionId?: string;
  sessionid?: string;
  category?: string;
  metadataType?: string;
  sessionName?: string;
  sessionname?: string;
  lastUpdated?: string;
  lastupdated?: string;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const HTTP_URL_PATTERN = /^https?:\/\//i;

function decodePathPreservingSlashes(candidate: string): string {
  try {
    return decodeURIComponent(candidate);
  } catch (error) {
    console.warn("Failed to decode blob preview path", { candidate, error });
    return candidate;
  }
}

function normalizePreviewUrl(rawUrl?: string, blobName?: string): string | undefined {
  if (!rawUrl && !blobName) {
    return undefined;
  }

  const trimmed = rawUrl?.trim();
  if (trimmed) {
    if (trimmed.startsWith("/")) {
      return decodePathPreservingSlashes(trimmed);
    }

    if (HTTP_URL_PATTERN.test(trimmed)) {
      try {
        const parsed = new URL(trimmed);
        const path = parsed.pathname || "";
        if (path) {
          return decodePathPreservingSlashes(path.startsWith("/") ? path : `/${path}`);
        }
      } catch (error) {
        const slashIndex = trimmed.indexOf("/", trimmed.indexOf("//") + 2);
        if (slashIndex >= 0) {
          const fallbackPath = trimmed.slice(slashIndex);
          return decodePathPreservingSlashes(
            fallbackPath.startsWith("/") ? fallbackPath : `/${fallbackPath}`,
          );
        }
        console.warn("Unable to parse blob URL for preview", { rawUrl: trimmed, error });
      }
    }

    const withLeadingSlash = `/${trimmed}`;
    return decodePathPreservingSlashes(withLeadingSlash);
  }

  if (blobName) {
    const normalizedBlobName = blobName.startsWith("/") ? blobName : `/${blobName}`;
    return decodePathPreservingSlashes(normalizedBlobName);
  }

  return undefined;
}

function mapFilePayload(payload: RawFilePayload = {}): FileAttachment {
  const candidateType = asString(payload.type);
  const resolvedContentType =
    asString(payload.contentType) ??
    (candidateType && candidateType.includes("/") ? candidateType : null);
  const blobName = asString(payload.blobName) ?? asString(payload.name) ?? "";
  const rawUrl = asString(payload.url) ?? "";
  const previewUrl = normalizePreviewUrl(rawUrl, blobName);

  return {
    blobName,
    url: rawUrl,
    previewUrl,
    originalName: asString(payload.originalName) ?? asString(payload.name) ?? "",
    size: asNumber(payload.size),
    contentType: resolvedContentType,
    uploadedAt: asString(payload.uploadedAt) ?? asString(payload.uploadedat) ?? null,
    lastUpdated: asString(payload.lastUpdated) ?? asString(payload.lastupdated) ?? null,
    sessionId: asString(payload.sessionId) ?? asString(payload.sessionid) ?? null,
    category: asString(payload.category) ?? undefined,
    metadataType: asString(payload.metadataType) ?? undefined,
    sessionName: asString(payload.sessionName) ?? asString(payload.sessionname) ?? null,
  };
}

export interface ListSessionFilesResult {
  files: FileAttachment[];
  deletedSessionIds: string[];
  sessionDeleted: boolean;
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

/**
 * Upload a base64 encoded payload to blob storage via the playground API and
 * return normalized attachment metadata.
 */
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

/**
 * Convenience wrapper that reads a File as a data URL before delegating to
 * `uploadEncodedFile`.
 */
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

export async function deleteRemoteSession({
  sessionId,
  accessToken,
}: {
  sessionId: string;
  accessToken: string;
}): Promise<void> {
  if (!sessionId) throw new Error("sessionId is required");
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const response = await fetch(sessionDeleteEndpoint(sessionId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  if (response.status === 204) {
    return;
  }

  const data = await handleJsonResponse(response);
  if (Array.isArray(data?.failed) && data.failed.length > 0) {
    const message = typeof data?.message === "string" && data.message.trim().length > 0
      ? data.message
      : "Delete completed with errors.";
    throw new Error(message);
  }

  return;
}

/**
 * Fetch the caller's attachments for a given session from the playground API.
 */
export async function listSessionFiles({
  accessToken,
  sessionId,
}: {
  accessToken: string;
  sessionId?: string;
}): Promise<ListSessionFilesResult> {
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const url = sessionId
    ? `${FILES_FOR_SESSION_ENDPOINT}?sessionId=${encodeURIComponent(sessionId)}`
    : FILES_FOR_SESSION_ENDPOINT;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  const data = await handleJsonResponse(response);
  const files = Array.isArray(data?.files) ? data.files : [];
  const normalizedFiles = files.map(mapFilePayload);
  const deletedRaw = Array.isArray(data?.deletedSessionIds) ? data.deletedSessionIds : [];
  const deletedSessionIdsSet = new Set<string>();
  for (const value of deletedRaw) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        deletedSessionIdsSet.add(trimmed);
      }
    }
  }
  const deletedSessionIds = Array.from(deletedSessionIdsSet);
  const sessionDeleted = data?.sessionDeleted === true;
  return { files: normalizedFiles, deletedSessionIds, sessionDeleted };
}

/**
 * Request server-side text extraction for an attachment so prompts can include
 * the relevant content without exposing blob credentials to the client.
 */
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

/**
 * Retrieve an attachment as a data URL, enabling inline previews in the UI.
 */
export async function fetchFileDataUrl({
  fileUrl,
  blobName,
  fileType,
  accessToken,
}: {
  fileUrl?: string | null;
  blobName?: string | null;
  fileType?: string | null;
  accessToken?: string | null;
}): Promise<{ dataUrl: string; contentType: string }> {
  if (!fileUrl && !blobName) throw new Error("fileUrl or blobName is required");

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken?.trim()) {
    headers.Authorization = `Bearer ${accessToken.trim()}`;
  }

  const response = await fetch(EXTRACT_FILE_TEXT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fileUrl,
      blobName,
      fileType,
      responseFormat: "data_url",
    }),
  });

  const data = await handleJsonResponse(response);
  return {
    dataUrl: typeof data?.dataUrl === "string" ? data.dataUrl : "",
    contentType: typeof data?.contentType === "string"
      ? data.contentType
      : fileType ?? "application/octet-stream",
  };
}
