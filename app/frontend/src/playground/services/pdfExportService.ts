import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";
import type { PDFDict as PdfDictInstance } from "pdf-lib";
import type { Message } from "../store/slices/chatSlice";
import type { Session } from "../store/slices/sessionSlice";
import type { FileAttachment } from "../types";

type PdfMakeStatic = typeof import("pdfmake/build/pdfmake");
type PdfLibModule = typeof import("pdf-lib");

type Translator = (key: string, options?: Record<string, unknown>) => string;

let pdfMakeInstance: PdfMakeStatic | null = null;
let pdfMakeLoader: Promise<PdfMakeStatic> | null = null;
let pdfLibLoader: Promise<PdfLibModule> | null = null;

interface AccessibleDocumentDefinition extends TDocumentDefinitions {
  lang?: string;
  pdfUa?: boolean;
}

export interface TranscriptExportOptions {
  session: Session;
  messages: Message[];
  locale?: string;
  timeZone?: string;
  translator: Translator;
}

/**
 * Generates an accessible PDF transcript for the provided session/messages and
 * triggers a browser download with WCAG-friendly metadata baked in.
 */
export async function downloadTranscriptPdf(options: TranscriptExportOptions): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("PDF export is only available in the browser context.");
  }

  const runtime = resolveRuntimePreferences(options);
  // Lazy-load heavy libraries only when a user requests an export.
  const pdfMake = await loadPdfMake();
  const docDefinition = buildDocumentDefinition(options, runtime);
  const fileName = buildFileName(options.session.name);
  const metadataHints = buildMetadataHints(options, runtime, docDefinition);

  const pdfDocGenerator = pdfMake.createPdf(docDefinition as TDocumentDefinitions);
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      // pdfmake uses callbacks; wrap into a Promise for async/await ergonomics.
      pdfDocGenerator.getBlob((generatedBlob: Blob) => resolve(generatedBlob));
    } catch (error) {
      reject(error);
    }
  });

  const accessibleBlob = await applyAccessibilityMetadata(blob, metadataHints);
  const finalBlob = accessibleBlob ?? blob;

  const blobUrl = URL.createObjectURL(finalBlob);
  const anchor = document.createElement("a");
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
}

/**
 * Loads pdfmake once (with font VFS) and reuses the instance for subsequent
 * exports to avoid multiple large dynamic imports.
 */
async function loadPdfMake(): Promise<PdfMakeStatic> {
  if (pdfMakeInstance) {
    return pdfMakeInstance;
  }

  if (!pdfMakeLoader) {
    pdfMakeLoader = (async () => {
      type PdfMakeWithVfs = PdfMakeStatic & {
        addVirtualFileSystem?: (vfs: Record<string, string>) => void;
        vfs?: Record<string, string>;
      };

      const pdfMakeModule = (await import("pdfmake/build/pdfmake")) as unknown as {
        default?: PdfMakeWithVfs;
      } & PdfMakeWithVfs;
      const pdfMake = (pdfMakeModule.default ?? pdfMakeModule) as PdfMakeWithVfs;

      const vfsModule = (await import("pdfmake/build/vfs_fonts")) as unknown as {
        default?: Record<string, string>;
      } & Record<string, string>;
      const virtualFileSystem = vfsModule.default ?? vfsModule;

      if (typeof pdfMake.addVirtualFileSystem === "function") {
        pdfMake.addVirtualFileSystem(virtualFileSystem);
      } else {
        pdfMake.vfs = virtualFileSystem;
      }

      pdfMakeInstance = pdfMake;
      pdfMakeLoader = null;
      return pdfMake;
    })();
  }

  const instance = await pdfMakeLoader;
  if (!instance) {
    throw new Error("Failed to initialise pdfMake");
  }
  pdfMakeInstance = instance;
  pdfMakeLoader = null;
  return instance;
}

interface ResolvedRuntimePreferences {
  locale: string;
  timeZone?: string;
}

/**
 * Normalises locale/time-zone preferences from the caller or browser so PDF
 * headers and timestamps render consistently.
 */
function resolveRuntimePreferences(options: TranscriptExportOptions): ResolvedRuntimePreferences {
  const locale = options.locale ?? (typeof navigator !== "undefined" ? navigator.language : "en-CA");
  const timeZone = options.timeZone ?? (typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : undefined);
  return { locale, timeZone };
}

/**
 * Converts chat data into a pdfmake document definition with styles, footer,
 * and PDF/UA-friendly metadata scaffolding.
 */
function buildDocumentDefinition(
  options: TranscriptExportOptions,
  runtime: ResolvedRuntimePreferences,
): AccessibleDocumentDefinition {
  const { session, messages, translator: t } = options;
  const { locale: resolvedLocale, timeZone: resolvedTimeZone } = runtime;
  // Ensure deterministic ordering even if the store still contains optimistic entries.
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const firstTimestamp = sorted[0]?.timestamp ?? Date.now();
  const lastTimestamp = sorted[sorted.length - 1]?.timestamp ?? Date.now();
  const totalMessages = sorted.length;

  const content: Content[] = [
    { text: t("pdf.title", { session: session.name }), style: "h1", margin: [0, 0, 0, 12], id: "chat-transcript-title" },
    buildMetaTable({ session, totalMessages, firstTimestamp, lastTimestamp, locale: resolvedLocale, timeZone: resolvedTimeZone, t }),
    { text: t("pdf.section.messages"), style: "h2", margin: [0, 24, 0, 12] },
    buildTranscriptTable(sorted, resolvedLocale, resolvedTimeZone, t),
  ];

  return {
    info: {
      title: t("pdf.title", { session: session.name }),
      author: "SSC Assistant",
      subject: t("pdf.meta.subject"),
      keywords: "chat transcript, pdf-ua, accessibility",
      creator: "SSC Assistant Playground",
      producer: "pdfmake",
    },
    lang: resolvedLocale,
    pdfUa: true,
    defaultStyle: {
      fontSize: 11,
      lineHeight: 1.4,
    },
    pageMargins: [52, 72, 52, 72],
    content,
    styles: {
      h1: { fontSize: 20, bold: true },
      h2: { fontSize: 14, bold: true },
      metaLabel: { bold: true },
      metaValue: {},
      userLabel: { bold: true },
      assistantLabel: { bold: true, color: "#0050b3" },
      systemLabel: { bold: true, color: "#444" },
      timestamp: { fontSize: 9, color: "#555" },
      messageBody: {},
      attachmentList: { margin: [0, 6, 0, 0] },
      citationList: { margin: [0, 6, 0, 0] },
    },
    footer: (currentPage: number, pageCount: number) => ({
      columns: [
        { text: t("pdf.footer.generated", { date: formatDateTime(Date.now(), resolvedLocale, resolvedTimeZone) }), alignment: "left", fontSize: 9 },
        { text: t("pdf.footer.page", { current: currentPage, total: pageCount }), alignment: "right", fontSize: 9 },
      ],
      margin: [52, 0, 52, 24],
    }),
  } satisfies AccessibleDocumentDefinition;
}

/**
 * Builds the top-of-document metadata summary (session name, counts, etc.).
 */
function buildMetaTable(params: {
  session: Session;
  totalMessages: number;
  firstTimestamp: number;
  lastTimestamp: number;
  locale: string;
  timeZone?: string;
  t: Translator;
}): Content {
  const { session, totalMessages, firstTimestamp, lastTimestamp, locale, timeZone, t } = params;
  return {
    style: "metaTable",
    table: {
      widths: [160, "*"],
      body: [
        [
          { text: t("pdf.meta.sessionName"), style: "metaLabel" },
          { text: session.name, style: "metaValue" },
        ],
        [
          { text: t("pdf.meta.created"), style: "metaLabel" },
          { text: formatDateTime(session.createdAt, locale, timeZone), style: "metaValue" },
        ],
        [
          { text: t("pdf.meta.firstMessage"), style: "metaLabel" },
          { text: formatDateTime(firstTimestamp, locale, timeZone), style: "metaValue" },
        ],
        [
          { text: t("pdf.meta.lastMessage"), style: "metaLabel" },
          { text: formatDateTime(lastTimestamp, locale, timeZone), style: "metaValue" },
        ],
        [
          { text: t("pdf.meta.messageCount"), style: "metaLabel" },
          { text: `${totalMessages}`, style: "metaValue" },
        ],
      ],
    },
    layout: "lightHorizontalLines",
  };
}

/**
 * Creates the two-column transcript table where the first column shows the
 * speaker metadata and the second contains the message body.
 */
function buildTranscriptTable(messages: Message[], locale: string, timeZone: string | undefined, t: Translator): Content {
  const body: TableCell[][] = messages.map((message) => buildMessageRow(message, locale, timeZone, t));

  return {
    table: {
      widths: [160, "*"],
      body,
    },
    layout: "lightHorizontalLines",
  };
}

/**
 * Formats a single message row with role/timestamp and rich message content.
 */
function buildMessageRow(message: Message, locale: string, timeZone: string | undefined, t: Translator): TableCell[] {
  const roleKey = roleKeyFor(message.role);
  const roleLabel = t(roleKey);
  const timestamp = formatDateTime(message.timestamp, locale, timeZone);
  const contentBlock = buildMessageContent(message, t);

  return [
    {
      stack: [
        { text: roleLabel, style: labelStyleFor(message.role) },
        { text: timestamp, style: "timestamp" },
      ],
    },
    { stack: contentBlock, style: "messageBody" },
  ];
}

/**
 * Produces the stacked message body including attachments/citations blocks.
 */
function buildMessageContent(message: Message, t: Translator): Content[] {
  const textContent = stripMarkdown(message.content ?? "");
  const fragments: Content[] = [];

  fragments.push({ text: textContent || t("pdf.message.empty"), margin: [0, 0, 0, 4] });

  const attachmentsBlock = buildAttachmentsBlock(message.attachments, t);
  if (attachmentsBlock) fragments.push(attachmentsBlock);

  const citationsBlock = buildCitationsBlock(message.citations, t);
  if (citationsBlock) fragments.push(citationsBlock);

  return fragments;
}

/**
 * Renders an attachment bullet list when a chat turn contains uploads.
 */
function buildAttachmentsBlock(attachments: FileAttachment[] | undefined, t: Translator): Content | null {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return {
    stack: [
      { text: t("pdf.message.attachments"), style: "metaLabel", margin: [0, 2, 0, 2] },
      {
        ul: attachments.map((attachment) => formatAttachment(attachment)),
        style: "attachmentList",
      },
    ],
    margin: [0, 4, 0, 4],
  };
}

/**
 * Renders an ordered citations list that mirrors what the UI displays inline.
 */
function buildCitationsBlock(citations: { title: string; url: string }[] | undefined, t: Translator): Content | null {
  if (!citations || citations.length === 0) {
    return null;
  }

  return {
    stack: [
      { text: t("pdf.message.citations"), style: "metaLabel", margin: [0, 2, 0, 2] },
      {
        ul: citations.map((citation, index) => `${index + 1}. ${citation.title}${citation.url ? ` (${citation.url})` : ""}`),
        style: "citationList",
      },
    ],
    margin: [0, 4, 0, 0],
  };
}

/**
 * Formats attachment metadata (name, size, optional URL) into plain text.
 */
function formatAttachment(attachment: FileAttachment): string {
  const name = attachment.originalName || attachment.blobName || "Attachment";
  const size = attachment.size ? ` · ${formatFileSize(attachment.size)}` : "";
  const urlLabel = formatAttachmentUrl(attachment.url);
  return `${name}${size}${urlLabel}`;
}

function formatAttachmentUrl(rawUrl?: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.replace(/^www\./, "");
    return hostname ? ` (${hostname})` : "";
  } catch {
    return "";
  }
}

/**
 * Converts raw byte counts to a short human-readable size label.
 */
function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Maps chat roles to i18n keys understood by the translations bundle.
 */
function roleKeyFor(role: Message["role"]): string {
  if (role === "assistant") return "pdf.role.assistant";
  if (role === "system") return "pdf.role.system";
  return "pdf.role.user";
}

/**
 * Returns the pdfmake style name associated with each chat role.
 */
function labelStyleFor(role: Message["role"]): string {
  if (role === "assistant") return "assistantLabel";
  if (role === "system") return "systemLabel";
  return "userLabel";
}

/**
 * Performs a best-effort markdown-to-plain-text conversion for PDF output.
 */
function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```/g, ""))
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/~{2}([^~]+)~{2}/g, "$1")
    .replace(/!\[([^\]]*)]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^\s*#+\s*(.*)$/gm, "$1")
    .replace(/[-*+]\s+(.*)/g, "$1")
    .replace(/\r?\n\r?\n+/g, "\n\n")
    .trim();
}

/**
 * Formats timestamps with the locale/time zone used elsewhere in the export.
 */
function formatDateTime(timestamp: number, locale: string, timeZone?: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  });
  return formatter.format(new Date(timestamp));
}

/**
 * Generates a safe filename derived from the session name.
 */
function buildFileName(sessionName: string): string {
  const safeName = sessionName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "chat-transcript";
  return `${safeName}-transcript.pdf`;
}

interface AccessibilityMetadataOptions {
  title: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creator?: string;
  producer?: string;
  lang?: string;
  direction?: "ltr" | "rtl";
  createdAt?: number;
  modifiedAt?: number;
  tabOrder?: "S" | "R" | "C" | "A";
}

/**
 * Prepares accessibility metadata that pdf-lib will later embed into the
 * binary PDF (language, tab order, timestamps, etc.).
 */
function buildMetadataHints(
  options: TranscriptExportOptions,
  runtime: ResolvedRuntimePreferences,
  docDefinition: AccessibleDocumentDefinition,
): AccessibilityMetadataOptions {
  const { session, messages } = options;
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp);
  const firstTimestamp = sorted[0]?.timestamp ?? session.createdAt;
  const lastTimestamp = sorted[sorted.length - 1]?.timestamp ?? firstTimestamp;
  const info = docDefinition.info ?? {};
  const keywords = typeof info.keywords === "string"
    ? info.keywords
        .split(/[,\n]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    : undefined;

  return {
    title: info.title ?? `Chat transcript – ${session.name}`,
    author: info.author,
    subject: info.subject,
    keywords,
    creator: info.creator,
    producer: info.producer,
    lang: runtime.locale,
    direction: isRtl(runtime.locale) ? "rtl" : "ltr",
    createdAt: firstTimestamp,
    modifiedAt: lastTimestamp,
    tabOrder: "S",
  };
}

/**
 * Returns true when the locale likely represents a right-to-left language.
 */
function isRtl(locale: string): boolean {
  const rtlPrefixes = ["ar", "fa", "he", "ur", "ps"].map((code) => code.toLowerCase());
  const normalized = locale.toLowerCase();
  return rtlPrefixes.some((prefix) => normalized.startsWith(prefix));
}

/**
 * Lazily imports pdf-lib so we can set metadata without inflating initial bundles.
 */
async function loadPdfLib(): Promise<PdfLibModule> {
  if (!pdfLibLoader) {
    pdfLibLoader = import("pdf-lib");
  }
  return pdfLibLoader;
}

/**
 * Opens the generated PDF and stamps accessibility metadata, silently falling
 * back to the original blob on failure.
 */
async function applyAccessibilityMetadata(blob: Blob, metadata: AccessibilityMetadataOptions): Promise<Blob> {
  try {
    const pdfLib = await loadPdfLib();
    const { PDFDocument, PDFName, PDFString, PDFBool, PDFDict } = pdfLib;
    const pdfDoc = await PDFDocument.load(await blob.arrayBuffer());

    if (metadata.title) {
      pdfDoc.setTitle(metadata.title, { showInWindowTitleBar: true });
    }
    if (metadata.author) pdfDoc.setAuthor(metadata.author);
    if (metadata.subject) pdfDoc.setSubject(metadata.subject);
    if (metadata.keywords?.length) pdfDoc.setKeywords(metadata.keywords);
    if (metadata.creator) pdfDoc.setCreator(metadata.creator);
    if (metadata.producer) pdfDoc.setProducer(metadata.producer);
    pdfDoc.setCreationDate(metadata.createdAt ? new Date(metadata.createdAt) : new Date());
    pdfDoc.setModificationDate(metadata.modifiedAt ? new Date(metadata.modifiedAt) : new Date());

    const catalog = pdfDoc.catalog;
    const context = pdfDoc.context;

    if (metadata.lang) {
      catalog.set(PDFName.of("Lang"), PDFString.of(metadata.lang));
    }

    // Force sensible defaults so assistive tech opens the transcript predictably.
    const viewerPrefsName = PDFName.of("ViewerPreferences");
    const existingViewerPrefs = catalog.get(viewerPrefsName);
    const viewerPrefsDict: PdfDictInstance = existingViewerPrefs instanceof PDFDict
      ? existingViewerPrefs
      : (context.obj({}) as PdfDictInstance);
    viewerPrefsDict.set(PDFName.of("DisplayDocTitle"), PDFBool.True);
    viewerPrefsDict.set(PDFName.of("NonFullScreenPageMode"), PDFName.of("UseNone"));
    viewerPrefsDict.set(PDFName.of("Direction"), PDFName.of(metadata.direction === "rtl" ? "R2L" : "L2R"));
    viewerPrefsDict.set(PDFName.of("ViewArea"), PDFName.of("CropBox"));
    viewerPrefsDict.set(PDFName.of("ViewClip"), PDFName.of("CropBox"));
    viewerPrefsDict.set(PDFName.of("PrintArea"), PDFName.of("CropBox"));
    viewerPrefsDict.set(PDFName.of("PrintClip"), PDFName.of("CropBox"));
    viewerPrefsDict.set(PDFName.of("PrintScaling"), PDFName.of("AppDefault"));
    catalog.set(viewerPrefsName, viewerPrefsDict);

    const tabOrder = PDFName.of(metadata.tabOrder ?? "S");
    pdfDoc.getPages().forEach((page) => {
      page.node.set(PDFName.of("Tabs"), tabOrder);
    });

    const updatedBytes = await pdfDoc.save();
    const arrayBuffer = updatedBytes.buffer as ArrayBuffer;
    return new Blob([arrayBuffer], { type: "application/pdf" });
  } catch (error) {
    console.error("Failed to apply accessibility metadata", error);
    return blob;
  }
}
