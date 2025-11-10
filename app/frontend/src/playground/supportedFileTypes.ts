// Mirror main app extractor support so playground uploads stay consistent across stacks.
export const SUPPORTED_MIME_TYPES: readonly string[] = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.ms-word.document.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "text/csv",
  "application/csv",
  "text/tab-separated-values",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "text/plain",
];

// Extensions complement MIME lookups for browsers that omit type information.
export const SUPPORTED_FILE_EXTENSIONS: readonly string[] = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".tsv",
  ".txt",
  ".ppt",
  ".pptx",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".bmp",
  ".webp",
  ".svg",
];

const TEXT_MIME_PREFIX = "text/";
const TEXT_ACCEPT_WILDCARD = "text/*";
const IMAGE_MIME_PREFIX = "image/";
const IMAGE_ACCEPT_WILDCARD = "image/*";

// Extract a lowercase extension (including dot) for case-insensitive matching.
function getExtensionNormalized(fileName: string): string | null {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot === -1) return null;
  return fileName.slice(lastDot).toLowerCase();
}

// Sets make repeated membership tests inexpensive while files are processed.
const supportedMimeSet = new Set(SUPPORTED_MIME_TYPES.map((mime) => mime.toLowerCase()));
const supportedExtensionSet = new Set(
  SUPPORTED_FILE_EXTENSIONS.map((extension) => extension.toLowerCase()),
);

// Guard drag/drop/paste selections before reading large binaries into memory.
export function isSupportedFile(file: File): boolean {
  const mime = file.type?.toLowerCase() ?? "";
  if (
    mime &&
    (supportedMimeSet.has(mime) || mime.startsWith(TEXT_MIME_PREFIX) || mime.startsWith(IMAGE_MIME_PREFIX))
  ) {
    return true;
  }

  const extension = getExtensionNormalized(file.name);
  if (extension && supportedExtensionSet.has(extension)) {
    return true;
  }

  return false;
}

// Compose a browser hint for the file picker while keeping deduplicated entries.
export const FILE_INPUT_ACCEPT_ATTRIBUTE = [
  TEXT_ACCEPT_WILDCARD,
  IMAGE_ACCEPT_WILDCARD,
  ...SUPPORTED_MIME_TYPES,
  ...SUPPORTED_FILE_EXTENSIONS,
]
  // Deduplicate while preserving order
  .filter((value, index, array) => array.indexOf(value) === index)
  .join(",");
