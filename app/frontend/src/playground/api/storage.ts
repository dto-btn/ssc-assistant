/**
 * Storage API for the Playground
 *
 * - Create: uses backend /api/1.0/upload (secured by API scope) which stamps metadata with user oid.
 * - Read/List/Update/Delete: uses the dev proxy to Azure Blob Storage with SAS (server.js),
 *   and performs client-side checks to ensure the caller's oid matches the blob's user_id metadata.
 *
 * Note: This runs entirely in the frontend "playground" folder and does not modify base project files.
 */

import { jwtDecode } from "jwt-decode";

// Reuse the existing upload path and blob container proxy base
const API_UPLOAD_URL = "/api/1.0/upload";
const CONTAINER_BASE = "/assistant-chat-files"; // proxied by server.js with SAS

// Optional: use absolute SAS URLs if available (avoids proxy query collision for comp=list/metadata)
type ImportMetaEnv = { VITE_BLOB_STORAGE_URL?: string; VITE_SAS_TOKEN?: string };
// Vite exposes import.meta.env; TS cannot narrow easily here without additional typing in this isolated module.
const BLOB_BASE_URL: string | undefined = (import.meta as unknown as { env?: ImportMetaEnv })?.env?.VITE_BLOB_STORAGE_URL;
const BLOB_SAS_TOKEN: string | undefined = (import.meta as unknown as { env?: ImportMetaEnv })?.env?.VITE_SAS_TOKEN; // no leading '?'

function buildAbsoluteUrl(path: string, query?: string): string | null {
  if (!BLOB_BASE_URL || !BLOB_SAS_TOKEN) return null;
  const base = BLOB_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const qs = query ? (query.startsWith("?") ? query.substring(1) : query) : "";
  const withQuery = qs ? `${base}${normalizedPath}?${qs}&${BLOB_SAS_TOKEN}` : `${base}${normalizedPath}?${BLOB_SAS_TOKEN}`;
  return withQuery;
}

// Azure Blob REST version header required for some operations
const X_MS_VERSION = "2025-08-10";

export interface BlobItem {
  name: string;
  url: string; // proxied path under CONTAINER_BASE
  contentLength?: number;
  contentType?: string;
  lastModified?: string;
  eTag?: string;
  metadata?: Record<string, string>;
}

type JwtWithOid = { oid?: string; [k: string]: unknown };

export function getOidFromAccessToken(accessToken: string): string | undefined {
  try {
    const payload = jwtDecode<JwtWithOid>(accessToken);
    return payload?.oid as string | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Create (Upload) a file via the secured backend endpoint.
 * The backend writes metadata user_id=oid for the caller.
 */
export async function createBlobViaApi(params: {
  encodedFile: string; // data URL or base64 string supported by backend
  name: string;
  accessToken: string; // API scope token
}): Promise<{ blobPath: string; blobName: string; fileName: string; message: string }>
{
  const { encodedFile, name, accessToken } = params;

  if (!encodedFile || !name) throw new Error("encodedFile and name are required");
  if (!accessToken?.trim()) throw new Error("accessToken is required");

  const res = await fetch(API_UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken.trim()}`,
    },
    body: JSON.stringify({ encoded_file: encodedFile, name }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errorText}`);
  }

  const data = await res.json();
  const url = new URL(data.file_url);
  // Derive blobName (path inside the container) from the pathname
  const pathname = decodeURIComponent(url.pathname);
  const containerPrefix = "/assistant-chat-files/";
  const blobName = pathname.startsWith(containerPrefix)
    ? pathname.substring(containerPrefix.length)
    : pathname.split("/").pop() || pathname;
  return {
    blobPath: pathname,
    blobName,
    fileName: name,
    message: data.message ?? "Uploaded",
  };
}

/**
 * Parse Azure Blob XML List response into BlobItem[]
 */
function parseBlobListXml(xmlText: string): BlobItem[] {
  const items: BlobItem[] = [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const blobNodes = doc.getElementsByTagName("Blob");

  for (let i = 0; i < blobNodes.length; i++) {
    const blob = blobNodes[i];
    const name = blob.getElementsByTagName("Name")[0]?.textContent || "";
    const props = blob.getElementsByTagName("Properties")[0];
    const metadataNode = blob.getElementsByTagName("Metadata")[0];

    const contentLength = props?.getElementsByTagName("Content-Length")[0]?.textContent;
    const contentType = props?.getElementsByTagName("Content-Type")[0]?.textContent;
    const lastModified = props?.getElementsByTagName("Last-Modified")[0]?.textContent;
    const eTag = props?.getElementsByTagName("Etag")[0]?.textContent;

    const metadata: Record<string, string> = {};
    if (metadataNode) {
      const metas = Array.from(metadataNode.children);
      for (const m of metas) {
        const key = m.nodeName.toLowerCase();
        metadata[key] = m.textContent || "";
      }
    }

    items.push({
      name,
      url: `${CONTAINER_BASE}/${encodeURIComponent(name)}`,
      contentLength: contentLength ? Number(contentLength) : undefined,
      contentType: contentType || undefined,
      lastModified: lastModified || undefined,
      eTag: eTag || undefined,
      metadata,
    });
  }

  return items;
}

/**
 * Read/List: returns the current user's blobs by filtering metadata.user_id === token oid.
 */
export async function listMyBlobs(accessToken: string): Promise<BlobItem[]> {
  const oid = getOidFromAccessToken(accessToken);
  if (!oid) throw new Error("Unable to determine user oid from access token");

  // include=metadata to retrieve metadata in the listing
  const abs = buildAbsoluteUrl(CONTAINER_BASE, "restype=container&comp=list&include=metadata");
  if (!abs) throw new Error("Blob base URL and SAS token are not configured for listing");
  const res = await fetch(abs, { headers: { "x-ms-version": X_MS_VERSION } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`List failed (${res.status}): ${text}`);
  }

  const xml = await res.text();
  const all = parseBlobListXml(xml);
  // user_id metadata key will be lower-cased by XML toLowerCase normalization above
  return all.filter((bi) => (bi.metadata?.["user_id"] || bi.metadata?.["user-id"]) === oid);
}

/**
 * Get blob metadata via HEAD (comp=metadata)
 */
export async function getBlobMetadata(blobName: string): Promise<Record<string, string>> {
  const url = `${CONTAINER_BASE}/${encodeURIComponent(blobName)}`;
  const res = await fetch(url, { method: "HEAD", headers: { "x-ms-version": X_MS_VERSION } });
  if (!res.ok) throw new Error(`Failed to read metadata (${res.status})`);
  // Azure returns x-ms-meta-<key> headers
  const metadata: Record<string, string> = {};
  res.headers.forEach((value, key) => {
    if (key.startsWith("x-ms-meta-")) {
      const metaKey = key.substring("x-ms-meta-".length);
      metadata[metaKey] = value;
    }
  });
  return metadata;
}

async function ensureOwnershipOrThrow(blobName: string, accessToken: string) {
  const oid = getOidFromAccessToken(accessToken);
  if (!oid) throw new Error("Unable to determine user oid from access token");
  const md = await getBlobMetadata(blobName);
  const owner = md["user_id"] || md["user-id"];
  if (!owner || owner !== oid) {
    throw new Error("Forbidden: You do not own this blob");
  }
}

/**
 * Update metadata (e.g., rename or custom tags). This overwrites metadata keys provided.
 * IMPORTANT: This performs a client-side ownership check before proceeding.
 */
export async function updateBlobMetadata(params: {
  blobName: string;
  metadata: Record<string, string | number | boolean>;
  accessToken: string;
}): Promise<void> {
  const { blobName, metadata, accessToken } = params;
  await ensureOwnershipOrThrow(blobName, accessToken);
  // Merge with existing metadata to avoid wiping keys like user_id
  const current = await getBlobMetadata(blobName);
  const merged: Record<string, string> = { ...current };
  for (const [k, v] of Object.entries(metadata)) {
    merged[k.toLowerCase()] = String(v);
  }
  const abs = buildAbsoluteUrl(`${CONTAINER_BASE}/${encodeURIComponent(blobName)}`, "comp=metadata");
  if (!abs) throw new Error("Blob base URL and SAS token are not configured for metadata update");
  const headers: Record<string, string> = {
    "x-ms-version": X_MS_VERSION,
    "x-ms-date": new Date().toUTCString(),
  };
  for (const [k, v] of Object.entries(merged)) {
    headers[`x-ms-meta-${k.toLowerCase()}`] = String(v);
  }

  const res = await fetch(abs, { method: "PUT", headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set metadata (${res.status}): ${text}`);
  }
}

/**
 * Delete a blob. Performs a client-side ownership check before deleting.
 */
export async function deleteBlob(params: { blobName: string; accessToken: string }): Promise<void> {
  const { blobName, accessToken } = params;
  await ensureOwnershipOrThrow(blobName, accessToken);

  const url = `${CONTAINER_BASE}/${encodeURIComponent(blobName)}`;
  const res = await fetch(url, { method: "DELETE", headers: { "x-ms-version": X_MS_VERSION } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete (${res.status}): ${text}`);
  }
}

/**
 * Download (read) a blob as a browser Blob. Performs a client-side ownership check first.
 */
export async function readBlob(params: { blobName: string; accessToken: string }): Promise<Blob> {
  const { blobName, accessToken } = params;
  await ensureOwnershipOrThrow(blobName, accessToken);

  const url = `${CONTAINER_BASE}/${encodeURIComponent(blobName)}`;
  const res = await fetch(url, { headers: { "x-ms-version": X_MS_VERSION } });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to read blob (${res.status}): ${text}`);
  }
  return await res.blob();
}

/**
 * Move a blob by copying to destination and deleting the source.
 * Requires SAS with read on source and write/delete on destination.
 */
export async function moveBlob(params: { sourceName: string; destName: string; accessToken: string }): Promise<void> {
  const { sourceName, destName, accessToken } = params;
  // Ensure the caller owns the source
  await ensureOwnershipOrThrow(sourceName, accessToken);

  const srcAbs = buildAbsoluteUrl(`${CONTAINER_BASE}/${encodeURIComponent(sourceName)}`);
  const destAbs = buildAbsoluteUrl(`${CONTAINER_BASE}/${encodeURIComponent(destName)}`);
  if (!srcAbs || !destAbs) throw new Error("Blob base URL and SAS token are not configured for move");

  // Copy to destination
  const copyRes = await fetch(destAbs, {
    method: "PUT",
    headers: {
      "x-ms-version": X_MS_VERSION,
      "x-ms-date": new Date().toUTCString(),
      "x-ms-copy-source": srcAbs,
    },
  });
  if (!copyRes.ok) {
    const text = await copyRes.text();
    throw new Error(`Copy failed (${copyRes.status}): ${text}`);
  }

  // Optional: small polling to ensure copy status is success
  const destHead = async () => fetch(destAbs, { method: "HEAD", headers: { "x-ms-version": X_MS_VERSION } });
  for (let i = 0; i < 5; i++) {
    const h = await destHead();
    const status = h.headers.get("x-ms-copy-status");
    if (!status || status.toLowerCase() === "success") break;
    await new Promise(r => setTimeout(r, 200));
  }

  // Delete source
  const delSrc = await fetch(`${CONTAINER_BASE}/${encodeURIComponent(sourceName)}`, { method: "DELETE", headers: { "x-ms-version": X_MS_VERSION } });
  if (!delSrc.ok) {
    // Non-fatal; log-only
    // console.warn("Failed to delete source after copy", await delSrc.text());
  }
}

/**
 * Convenience: rename by copying metadata name field and recommending clients re-upload for actual rename.
 * Note: True rename requires copy+delete in Blob Storage. Implementing that would require additional permissions.
 */
export async function renameBlobLabel(params: { blobName: string; newLabel: string; accessToken: string }): Promise<void> {
  const { blobName, newLabel, accessToken } = params;
  await updateBlobMetadata({ blobName, metadata: { label: newLabel }, accessToken });
}
