import { FileAttachment, FileCategory } from "../types";

const PLAYGROUND_API_BASE = "/api/playground";
const UPLOAD_ENDPOINT = `${PLAYGROUND_API_BASE}/upload`;
const FILES_FOR_SESSION_ENDPOINT = `${PLAYGROUND_API_BASE}/files-for-session`;
const EXTRACT_FILE_TEXT_ENDPOINT = `${PLAYGROUND_API_BASE}/extract-file-text`;
const sessionsEndpoint = `${PLAYGROUND_API_BASE}/sessions`;
const sessionRenameEndpoint = (sessionId: string) => `${sessionsEndpoint}/${encodeURIComponent(sessionId)}/rename`;
const sessionDeleteEndpoint = (sessionId: string) => `${sessionsEndpoint}/${encodeURIComponent(sessionId)}`;

type MetadataRecord = Record<string, string | number | boolean | null | undefined>;

export class PlaygroundApiError extends Error {
  status: number;
  responseText: string;

  constructor(status: number, responseText: string) {
    const normalizedText = responseText.trim();
    super(normalizedText || `Request failed (${status})`);
    this.name = "PlaygroundApiError";
    this.status = status;
    this.responseText = normalizedText;
  }
}

/**
 * Read the MIME type from a ``data:`` URL so uploads inherit the browser-provided hint.
 */
function extractMimeType(encoded: string | undefined): string | undefined {
  if (!encoded) return undefined;
  const match = /^data:([^;,]+)[;,]/i.exec(encoded);
  return match ? match[1] : undefined;
}

/**
 * Convert an arbitrary metadata dictionary into the lowercase string map expected by the API.
 */
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

/**
 * Normalize API blob URLs or blob names into the same relative preview path
 * shape used by the frontend preview and archive flows.
 */
export function normalizePreviewUrl(rawUrl?: string, blobName?: string): string | undefined {
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
          // Strip the origin so previews continue to resolve through the app host.
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

    const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return decodePathPreservingSlashes(withLeadingSlash);
  }

  if (blobName) {
    const normalizedBlobName = blobName.startsWith("/") ? blobName : `/${blobName}`;
    return decodePathPreservingSlashes(normalizedBlobName);
  }

  return undefined;
}

/**
 * Normalize API casing differences into the attachment model used by Redux and the UI.
 */
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

/**
 * Raise a helpful error when the API returns non-success codes so callers can surface context.
 */
async function handleJsonResponse(response: Response) {
  if (!response.ok) {
    const text = await response.text();
    throw new PlaygroundApiError(response.status, text);
  }
  return response.json();
}

/**
 * Decide whether a failed upload is worth retrying automatically.
 */
export function isRetriableUploadError(error: unknown): boolean {
  if (error instanceof PlaygroundApiError) {
    return error.status === 401 || error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }
  // Browser/network failures surface as TypeError from fetch.
  if (error instanceof TypeError) {
    return true;
  }
  return true;
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


/**
 * Soft delete every blob tied to a session by calling the playground API on behalf of the user.
 */
export async function deleteRemoteSession({
  sessionId,
  accessToken,
}: {
  sessionId: string;
  accessToken: string;
}): Promise<number> {
  if (!sessionId) throw new Error("sessionId is required");
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const response = await fetch(sessionDeleteEndpoint(sessionId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  if (response.status === 204) {
    return 0;
  }

  const data = await handleJsonResponse(response);
  if (Array.isArray(data?.failed) && data.failed.length > 0) {
    const message = typeof data?.message === "string" && data.message.trim().length > 0
      ? data.message
      : "Delete completed with errors.";
    throw new Error(message);
  }

  const deleted = typeof data?.deletedCount === "number" ? data.deletedCount : 0;
  if (deleted < 0) {
    console.warn("Unexpected negative delete count received", { deleted });
  }
  return deleted;
}

/**
 * Soft delete every blob tied to the user by calling the playground API.
 */
export async function deleteAllRemoteSessions({
  accessToken,
}: {
  accessToken: string;
}): Promise<{ deletedCount: number; failed: string[]; message?: string }> {
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const response = await fetch(sessionsEndpoint, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken.trim()}`,
    },
  });

  if (response.status === 204) {
    return { deletedCount: 0, failed: [] };
  }

  const data = await handleJsonResponse(response);
  const deletedCount = typeof data?.deletedCount === "number" ? data.deletedCount : 0;
  const failed = Array.isArray(data?.failed) ? data.failed : [];
  const message = typeof data?.message === "string" ? data.message : undefined;

  return { deletedCount, failed, message };
}

/**
 * Rename a stored playground session via the API.
 */
export async function renameRemoteSession({
  sessionId,
  name,
  accessToken,
}: {
  sessionId: string;
  name: string;
  accessToken: string;
}): Promise<number> {
  if (!sessionId) throw new Error("sessionId is required");
  const trimmedName = name?.trim();
  if (!trimmedName) throw new Error("name is required");
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const response = await fetch(sessionRenameEndpoint(sessionId), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({ name: trimmedName }),
  });

  const data = await handleJsonResponse(response);
  return typeof data?.updatedCount === "number" ? data.updatedCount : 0;
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
  // Older payloads can repeat ids; collapse them before reconciling local state.
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
