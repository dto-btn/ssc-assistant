import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import mermaid from "mermaid";
import type { FileAttachment } from "../types";
import type { Message } from "../store/slices/chatSlice";
import type { Session } from "../store/slices/sessionSlice";
import { groupCitationsByUrl, processTextWithCitations } from "../utils/citations";

type ExportableMessage = Omit<Message, "feedback">;

export type PlaygroundExportFormat = "json" | "pdf" | "word";

export interface SessionExportAttachment {
  blobName: string;
  originalName: string;
  url: string;
  previewUrl?: string;
  contentType?: string | null;
  size?: number;
  uploadedAt?: string | null;
  lastUpdated?: string | null;
}

export interface SessionExportCitation {
  title: string;
  url: string;
  content?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface SessionExportCitationGroup {
  url: string;
  title: string;
  displayNumber: number;
  citations: SessionExportCitation[];
}

export interface SessionExportMessage {
  id: string;
  role: "user" | "assistant" | "system";
  timestamp: number;
  content: string;
  renderedContent: string;
  citations: SessionExportCitation[];
  citationNumberMapping: Record<number, number>;
  citationGroups: SessionExportCitationGroup[];
  attachments: SessionExportAttachment[];
  mermaidDiagrams: SessionExportMermaidDiagram[];
  mermaidDataRows: SessionExportDataRow[];
}

export interface SessionExportMermaidDiagram {
  id: string;
  code: string;
}

export interface SessionExportDataRow {
  id: string;
  [key: string]: string | number;
}

export interface SessionExportDocument {
  version: "1.0";
  exportedAt: string;
  session: {
    id: string;
    name: string;
    createdAt: number;
  };
  messages: SessionExportMessage[];
  sessionAttachments: SessionExportAttachment[];
}

export interface AttachmentExportData {
  bytes: Uint8Array;
  contentType: string;
}

export type AttachmentDataResolver = (
  attachment: SessionExportAttachment,
) => Promise<AttachmentExportData | null>;

interface BuildSessionExportDocumentOptions {
  session: Session;
  messages: ExportableMessage[];
  sessionFiles: FileAttachment[];
  exportedAt?: string;
}

const mapAttachment = (attachment: FileAttachment): SessionExportAttachment => ({
  blobName: attachment.blobName,
  originalName: attachment.originalName,
  url: attachment.url,
  previewUrl: attachment.previewUrl,
  contentType: attachment.contentType,
  size: attachment.size,
  uploadedAt: attachment.uploadedAt,
  lastUpdated: attachment.lastUpdated,
});

const makeAttachmentKey = (attachment: FileAttachment): string => {
  if (attachment.blobName) {
    return `blob:${attachment.blobName}`;
  }

  return `name:${attachment.originalName}|url:${attachment.url}`;
};

const dedupeAttachments = (attachments: FileAttachment[]): SessionExportAttachment[] => {
  const byKey = new Map<string, SessionExportAttachment>();

  attachments.forEach((attachment) => {
    byKey.set(makeAttachmentKey(attachment), mapAttachment(attachment));
  });

  return Array.from(byKey.values());
};

const sanitizeFileNameSegment = (value: string): string => {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 40);
};

const normalizeMarkdownForExport = (value: string): string => {
  return value
    .replace(/\[(\d+)\]\(<([^>]+)>\)/g, "[$1] $2")
    .replace(/\[(\d+)\]\(([^)]+)\)/g, "[$1] $2")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[\t ]+$/gm, "")
    .trim();
};

const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return String(timestamp);
  }

  return date.toLocaleString();
};

const triggerDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const splitLines = (value: string): string[] => {
  const normalized = normalizeMarkdownForExport(value);
  if (!normalized) {
    return [""];
  }

  return normalized.split(/\r?\n/);
};

const scaleToFit = (
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } => {
  const widthRatio = maxWidth / width;
  const heightRatio = maxHeight / height;
  const scale = Math.min(widthRatio, heightRatio, 1);
  return {
    width: width * scale,
    height: height * scale,
  };
};

let mermaidInitialized = false;

const ensureMermaidInitialized = (): void => {
  if (mermaidInitialized) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
  });

  mermaidInitialized = true;
};

const toSlug = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
};

export const extractMermaidDiagrams = (value: string): SessionExportMermaidDiagram[] => {
  const diagrams: SessionExportMermaidDiagram[] = [];
  const regex = /```mermaid\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null = regex.exec(value);

  while (match) {
    const code = match[1].trim();
    if (code) {
      diagrams.push({
        id: `mermaid-${diagrams.length + 1}-${toSlug(code.split(/\r?\n/, 1)[0] || "diagram")}`,
        code,
      });
    }
    match = regex.exec(value);
  }

  return diagrams;
};

export const extractMermaidDataRows = (value: string): SessionExportDataRow[] => {
  const diagrams = extractMermaidDiagrams(value);
  if (diagrams.length === 0) {
    return [];
  }

  const rows: SessionExportDataRow[] = [];
  const seen = new Set<string>();

  const normalizeNodeToken = (token: string): string => {
    return token
      .replace(/[()[\]{}]/g, "")
      .replace(/^"|"$/g, "")
      .trim();
  };

  const addRow = (row: Record<string, string | number>) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    rows.push({ id: String(rows.length + 1), ...row });
  };

  const addRowsFromLines = (lines: string[]) => {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) {
        continue;
      }

      if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|xychart-beta)\b/i.test(line)) {
        continue;
      }

      const pieLineMatch = line.match(/^"(.+?)"\s*:\s*(-?\d+(?:\.\d+)?)$/);
      if (pieLineMatch) {
        addRow({ type: "metric", label: pieLineMatch[1].trim(), value: Number(pieLineMatch[2]) });
        continue;
      }

      const bulletCountMatch = line.match(/^(?:[-*]|\d+\.)\s*(.+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:brs?)?\s*$/i);
      if (bulletCountMatch) {
        addRow({ type: "metric", label: bulletCountMatch[1].trim(), value: Number(bulletCountMatch[2]) });
        continue;
      }

      const plainCountMatch = line.match(/^(.+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:brs?)?\s*$/i);
      if (plainCountMatch) {
        addRow({ type: "metric", label: plainCountMatch[1].trim(), value: Number(plainCountMatch[2]) });
        continue;
      }

      const sequenceMatch = line.match(/^(.+?)\s*(->>|-->>|->|-->|=>|==>|--x|--o)\s*(.+?)\s*:\s*(.+)$/);
      if (sequenceMatch) {
        addRow({
          type: "interaction",
          source: normalizeNodeToken(sequenceMatch[1]),
          relation: sequenceMatch[2],
          target: normalizeNodeToken(sequenceMatch[3]),
          message: sequenceMatch[4].trim(),
        });
        continue;
      }

      const labeledEdgeMatch = line.match(/^(.+?)\s*(-->|---|-.->|==>|===|<--|<-->)\|(.+?)\|\s*(.+)$/);
      if (labeledEdgeMatch) {
        addRow({
          type: "edge",
          source: normalizeNodeToken(labeledEdgeMatch[1]),
          relation: labeledEdgeMatch[2],
          label: labeledEdgeMatch[3].trim(),
          target: normalizeNodeToken(labeledEdgeMatch[4]),
        });
        continue;
      }

      const edgeMatch = line.match(/^(.+?)\s*(-->|---|-.->|==>|===|<--|<-->)\s*(.+)$/);
      if (edgeMatch) {
        addRow({
          type: "edge",
          source: normalizeNodeToken(edgeMatch[1]),
          relation: edgeMatch[2],
          target: normalizeNodeToken(edgeMatch[3]),
        });
      }
    }
  };

  diagrams.forEach((diagram) => addRowsFromLines(diagram.code.split("\n")));

  if (rows.length < 2) {
    return [];
  }

  const structureCounts = new Map<string, number>();
  rows.forEach((row) => {
    const shape = Object.keys(row)
      .filter((key) => key !== "id")
      .sort()
      .join("|");
    structureCounts.set(shape, (structureCounts.get(shape) || 0) + 1);
  });

  const hasRepeatingStructure = Array.from(structureCounts.values()).some((count) => count > 1);
  if (!hasRepeatingStructure) {
    return [];
  }

  return rows;
};

const toExportCellValue = (value: unknown): string | number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value === null || value === undefined) {
    return "";
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const extractBrArtifactRows = (message: ExportableMessage): SessionExportDataRow[] => {
  const brData = message.brArtifacts?.brData;
  if (!Array.isArray(brData) || brData.length === 0) {
    return [];
  }

  return brData.map((row, rowIndex) => {
    const mappedRow: SessionExportDataRow = { id: String(rowIndex + 1) };
    Object.entries(row).forEach(([key, value]) => {
      mappedRow[key] = toExportCellValue(value);
    });
    return mappedRow;
  });
};

const mergeDataRows = (
  primaryRows: SessionExportDataRow[],
  secondaryRows: SessionExportDataRow[],
): SessionExportDataRow[] => {
  const merged: SessionExportDataRow[] = [];
  const seen = new Set<string>();

  const appendRows = (rows: SessionExportDataRow[]) => {
    rows.forEach((row) => {
      const dedupeKey = JSON.stringify(
        Object.entries(row)
          .filter(([key]) => key !== "id")
          .sort(([left], [right]) => left.localeCompare(right)),
      );

      if (seen.has(dedupeKey)) {
        return;
      }

      seen.add(dedupeKey);
      merged.push({ ...row, id: String(merged.length + 1) });
    });
  };

  appendRows(primaryRows);
  appendRows(secondaryRows);

  return merged;
};

const base64DataUrlToBytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(",", 2)[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

interface MermaidImageRender {
  pngBytes: Uint8Array;
  width: number;
  height: number;
}

const renderMermaidToImage = async (
  diagram: SessionExportMermaidDiagram,
  options?: { pixelScale?: number },
): Promise<MermaidImageRender | null> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  ensureMermaidInitialized();

  try {
    const rendered = await mermaid.render(diagram.id, diagram.code);
    const svgBlob = new Blob([rendered.svg], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error("Unable to load Mermaid SVG image"));
        element.src = svgUrl;
      });

      const logicalWidth = Math.max(1, image.naturalWidth || image.width || 800);
      const logicalHeight = Math.max(1, image.naturalHeight || image.height || 450);

      const pixelScale = Math.max(1, Math.min(4, options?.pixelScale ?? 2.5));
      const width = Math.max(1, Math.round(logicalWidth * pixelScale));
      const height = Math.max(1, Math.round(logicalHeight * pixelScale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        return null;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(image, 0, 0, width, height);
      const pngDataUrl = canvas.toDataURL("image/png");
      return {
        pngBytes: base64DataUrlToBytes(pngDataUrl),
        width: logicalWidth,
        height: logicalHeight,
      };
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  } catch {
    return null;
  }
};

export const buildSessionExportDocument = ({
  session,
  messages,
  sessionFiles,
  exportedAt,
}: BuildSessionExportDocumentOptions): SessionExportDocument => {
  const mappedMessages = messages
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((message) => {
      const citations = message.citations ?? [];
      const processed = processTextWithCitations(message.content, citations);
      const citationGroups = groupCitationsByUrl(
        processed.citedCitations,
        citations,
        processed.citationNumberMapping,
      );

      return {
        id: message.id,
        role: message.role,
        timestamp: message.timestamp,
        content: message.content,
        renderedContent: processed.processedText,
        citations,
        citationNumberMapping: processed.citationNumberMapping,
        citationGroups: citationGroups.map((group) => ({
          url: group.url,
          title: group.title,
          displayNumber: group.displayNumber,
          citations: group.citations,
        })),
        attachments: dedupeAttachments(message.attachments ?? []),
        mermaidDiagrams: extractMermaidDiagrams(message.content),
        mermaidDataRows: mergeDataRows(
          extractBrArtifactRows(message),
          extractMermaidDataRows(message.content),
        ),
      } satisfies SessionExportMessage;
    });

  return {
    version: "1.0",
    exportedAt: exportedAt ?? new Date().toISOString(),
    session: {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
    },
    messages: mappedMessages,
    sessionAttachments: dedupeAttachments(sessionFiles),
  };
};

export const buildSessionExportFileName = (
  sessionName: string,
  format: PlaygroundExportFormat,
): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeFileNameSegment(sessionName) || "chat-session";
  const ext = format === "word" ? "docx" : format;
  return `ssc-assistant-${safeName}-${timestamp}.${ext}`;
};

export const downloadSessionExportJson = (
  sessionName: string,
  document: SessionExportDocument,
): void => {
  const blob = new Blob([JSON.stringify(document, null, 2)], {
    type: "application/json",
  });

  triggerDownload(blob, buildSessionExportFileName(sessionName, "json"));
};

const createPdfTextWriter = async (pdfDoc: PDFDocument) => {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const fontSize = 10;
  const lineHeight = 14;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - margin;

  const writeLine = (text: string, options?: { bold?: boolean; size?: number }) => {
    const activeSize = options?.size ?? fontSize;
    const maxWidth = pageWidth - margin * 2;
    const words = text.split(/\s+/).filter(Boolean);
    const drawFont = options?.bold ? fontBold : font;
    let current = "";

    const flush = () => {
      if (cursorY < margin + lineHeight) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - margin;
      }
      page.drawText(current || " ", {
        x: margin,
        y: cursorY,
        size: activeSize,
        font: drawFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      cursorY -= lineHeight;
    };

    if (!words.length) {
      flush();
      return;
    }

    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      const candidateWidth = drawFont.widthOfTextAtSize(candidate, activeSize);
      if (candidateWidth > maxWidth && current) {
        flush();
        current = word;
      } else {
        current = candidate;
      }
    });

    if (current) {
      flush();
    }
  };

  const addGap = (height = 6) => {
    cursorY -= height;
    if (cursorY < margin + lineHeight) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      cursorY = pageHeight - margin;
    }
  };

  const addPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = pageHeight - margin;
  };

  const drawTable = (rows: SessionExportDataRow[]) => {
    if (!rows.length) {
      return;
    }

    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row)
          .filter((key) => key !== "id")
          .forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );

    if (!columns.length) {
      return;
    }

    const tableWidth = pageWidth - margin * 2;
    const minRowHeight = 18;
    const cellPadding = 4;
    const maxColumnsPerChunk = 6;
    const tableFontSize = 9;
    const tableLineHeight = 11;
    const columnChunks: string[][] = [];

    for (let start = 0; start < columns.length; start += maxColumnsPerChunk) {
      columnChunks.push(columns.slice(start, start + maxColumnsPerChunk));
    }

    const splitCellText = (value: string, cellWidth: number): string[] => {
      const normalized = value.replace(/\s+/g, " ").trim();
      if (!normalized) {
        return [""];
      }

      const maxWidth = Math.max(16, cellWidth - cellPadding * 2);
      const words = normalized.split(" ");
      const lines: string[] = [];
      let currentLine = "";

      words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        const candidateWidth = font.widthOfTextAtSize(candidate, tableFontSize);
        if (candidateWidth <= maxWidth || !currentLine) {
          currentLine = candidate;
          return;
        }

        lines.push(currentLine);
        currentLine = word;
      });

      if (currentLine) {
        lines.push(currentLine);
      }

      return lines.slice(0, 3);
    };

    const ensureSpace = (heightNeeded: number) => {
      if (cursorY - heightNeeded < margin) {
        addPage();
      }
    };

    const drawHeader = (chunkColumns: string[], cellWidth: number) => {
      const headerHeight = minRowHeight;
      ensureSpace(headerHeight + 6);
      page.drawRectangle({
        x: margin,
        y: cursorY - headerHeight,
        width: cellWidth * chunkColumns.length,
        height: headerHeight,
        color: rgb(0.93, 0.93, 0.93),
        borderColor: rgb(0.75, 0.75, 0.75),
        borderWidth: 1,
      });

      chunkColumns.forEach((column, columnIndex) => {
        const x = margin + columnIndex * cellWidth;
        page.drawRectangle({
          x,
          y: cursorY - headerHeight,
          width: cellWidth,
          height: headerHeight,
          borderColor: rgb(0.75, 0.75, 0.75),
          borderWidth: 1,
        });
        page.drawText(column.charAt(0).toUpperCase() + column.slice(1), {
          x: x + cellPadding,
          y: cursorY - headerHeight + 5,
          size: tableFontSize,
          font: fontBold,
          color: rgb(0.15, 0.15, 0.15),
        });
      });

      cursorY -= headerHeight;
    };

    columnChunks.forEach((chunkColumns, chunkIndex) => {
      const columnWidth = tableWidth / chunkColumns.length;

      if (columnChunks.length > 1) {
        addGap(4);
        writeLine(
          `Data Grid Columns ${chunkIndex * maxColumnsPerChunk + 1}-${chunkIndex * maxColumnsPerChunk + chunkColumns.length} of ${columns.length}`,
          { bold: true },
        );
      }

      drawHeader(chunkColumns, columnWidth);

      rows.forEach((row, rowIndex) => {
        const lineCounts = chunkColumns.map((column) => splitCellText(String(row[column] ?? ""), columnWidth).length);
        const rowHeight = Math.max(minRowHeight, lineCounts.reduce((max, count) => Math.max(max, count), 1) * tableLineHeight + 8);

        if (cursorY - rowHeight < margin) {
          addPage();
          drawHeader(chunkColumns, columnWidth);
        }

        if (rowIndex % 2 === 1) {
          page.drawRectangle({
            x: margin,
            y: cursorY - rowHeight,
            width: tableWidth,
            height: rowHeight,
            color: rgb(0.98, 0.98, 0.98),
          });
        }

        chunkColumns.forEach((column, columnIndex) => {
          const x = margin + columnIndex * columnWidth;
          page.drawRectangle({
            x,
            y: cursorY - rowHeight,
            width: columnWidth,
            height: rowHeight,
            borderColor: rgb(0.82, 0.82, 0.82),
            borderWidth: 1,
          });

          const rawValue = row[column];
          const lines = splitCellText(String(rawValue ?? ""), columnWidth);
          lines.forEach((line, lineIndex) => {
            page.drawText(line, {
              x: x + cellPadding,
              y: cursorY - rowHeight + 5 + (lines.length - lineIndex - 1) * tableLineHeight,
              size: tableFontSize,
              font,
              color: rgb(0.18, 0.18, 0.18),
            });
          });
        });

        cursorY -= rowHeight;
      });

      addGap(8);
    });
  };

  const getPageMetrics = () => ({
    page,
    pageWidth,
    pageHeight,
    margin,
    cursorY,
    setCursorY: (value: number) => {
      cursorY = value;
    },
    addPage,
  });

  return {
    writeLine,
    addGap,
    addPage,
    drawTable,
    getPageMetrics,
  };
};

export const downloadSessionExportPdf = async (
  sessionName: string,
  document: SessionExportDocument,
  resolveAttachmentData?: AttachmentDataResolver,
): Promise<void> => {
  const pdfDoc = await PDFDocument.create();
  const writer = await createPdfTextWriter(pdfDoc);

  writer.writeLine(`SSC Assistant Export: ${document.session.name}`, { bold: true, size: 14 });
  writer.writeLine(`Session ID: ${document.session.id}`);
  writer.writeLine(`Exported at: ${new Date(document.exportedAt).toLocaleString()}`);
  writer.addGap(10);

  for (const [index, message] of document.messages.entries()) {
    writer.writeLine(`Message ${index + 1} - ${message.role.toUpperCase()} - ${formatTimestamp(message.timestamp)}`, {
      bold: true,
    });

    splitLines(message.renderedContent).forEach((line) => writer.writeLine(line));

    if (message.mermaidDiagrams.length > 0) {
      writer.addGap(4);
      writer.writeLine("Diagrams", { bold: true });

      for (const diagram of message.mermaidDiagrams) {
        const renderedDiagram = await renderMermaidToImage(diagram, { pixelScale: 3 });
        if (!renderedDiagram) {
          writer.writeLine("Mermaid diagram (code)");
          splitLines(diagram.code).forEach((line) => writer.writeLine(`  ${line}`));
          continue;
        }

        const metrics = writer.getPageMetrics();
        const embedded = await pdfDoc.embedPng(renderedDiagram.pngBytes);
        const scaled = scaleToFit(
          renderedDiagram.width,
          renderedDiagram.height,
          metrics.pageWidth - metrics.margin * 2,
          260,
        );

        if (metrics.cursorY - scaled.height < metrics.margin) {
          writer.addPage();
        }

        const freshMetrics = writer.getPageMetrics();
        const x = freshMetrics.margin;
        const y = Math.max(freshMetrics.margin, freshMetrics.cursorY - scaled.height);

        freshMetrics.page.drawImage(embedded, {
          x,
          y,
          width: scaled.width,
          height: scaled.height,
        });
        freshMetrics.setCursorY(y - 10);
      }
    }

    if (message.mermaidDataRows.length > 0) {
      writer.addGap(4);
      writer.writeLine("Data Grid", { bold: true });
      writer.drawTable(message.mermaidDataRows);
    }

    if (message.citationGroups.length > 0) {
      writer.addGap(4);
      writer.writeLine("Sources", { bold: true });
      message.citationGroups.forEach((group) => {
        writer.writeLine(`[${group.displayNumber}] ${group.title}`);
        writer.writeLine(group.url);
      });
    }

    if (message.attachments.length > 0) {
      writer.addGap(4);
      writer.writeLine("Attachments", { bold: true });
      message.attachments.forEach((attachment) => {
        writer.writeLine(`- ${attachment.originalName || attachment.blobName}`);
        if (attachment.url) {
          writer.writeLine(`  ${attachment.url}`);
        }
      });
    }

    writer.addGap(10);
  }

  if (resolveAttachmentData) {
    for (const attachment of document.sessionAttachments) {
      const contentType = attachment.contentType?.toLowerCase() || "";
      const isImage = contentType.startsWith("image/");
      const isPdfAttachment = contentType === "application/pdf";
      if (!isImage && !isPdfAttachment) {
        continue;
      }

      try {
        const resolved = await resolveAttachmentData(attachment);
        if (!resolved) {
          continue;
        }

        if (isImage) {
          writer.addPage();
          writer.writeLine(`Attachment: ${attachment.originalName || attachment.blobName}`, { bold: true, size: 12 });
          writer.addGap(8);

          const metrics = writer.getPageMetrics();
          const image = contentType.includes("png")
            ? await pdfDoc.embedPng(resolved.bytes)
            : await pdfDoc.embedJpg(resolved.bytes);
          const scaled = scaleToFit(
            image.width,
            image.height,
            metrics.pageWidth - metrics.margin * 2,
            metrics.pageHeight - metrics.margin * 2 - 30,
          );
          const x = metrics.margin;
          const y = Math.max(metrics.margin, metrics.cursorY - scaled.height);
          metrics.page.drawImage(image, {
            x,
            y,
            width: scaled.width,
            height: scaled.height,
          });
          metrics.setCursorY(y - 10);
          continue;
        }

        const donor = await PDFDocument.load(resolved.bytes);
        const pageCount = donor.getPageCount();
        if (pageCount === 0) {
          continue;
        }

        const copiedPages = await pdfDoc.copyPages(
          donor,
          Array.from({ length: pageCount }, (_, index) => index),
        );
        copiedPages.forEach((copiedPage) => {
          pdfDoc.addPage(copiedPage);
        });
      } catch {
        // Continue export even if attachment embedding fails for one file.
      }
    }
  }

  const bytes = await pdfDoc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  triggerDownload(blob, buildSessionExportFileName(sessionName, "pdf"));
};

const lineToDocxParagraph = (line: string): Paragraph => {
  const trimmed = line.trim();
  if (!trimmed) {
    return new Paragraph({ children: [new TextRun("")] });
  }

  if (trimmed.startsWith("### ")) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_3,
      children: [new TextRun(trimmed.slice(4))],
    });
  }

  if (trimmed.startsWith("## ")) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(trimmed.slice(3))],
    });
  }

  if (trimmed.startsWith("# ")) {
    return new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(trimmed.slice(2))],
    });
  }

  if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
    return new Paragraph({
      bullet: { level: 0 },
      children: [new TextRun(trimmed.slice(2))],
    });
  }

  return new Paragraph({ children: [new TextRun(trimmed)] });
};

const buildWordTableSections = (rows: SessionExportDataRow[]): Array<Paragraph | Table> => {
  if (!rows.length) {
    return [];
  }

  const columns = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row)
        .filter((key) => key !== "id")
        .forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  if (!columns.length) {
    return [];
  }

  const maxColumnsPerChunk = 6;
  const sections: Array<Paragraph | Table> = [];

  for (let start = 0; start < columns.length; start += maxColumnsPerChunk) {
    const chunkColumns = columns.slice(start, start + maxColumnsPerChunk);

    if (columns.length > maxColumnsPerChunk) {
      sections.push(new Paragraph({
        children: [
          new TextRun({
            text: `Columns ${start + 1}-${start + chunkColumns.length} of ${columns.length}`,
            bold: true,
          }),
        ],
      }));
    }

    const header = new TableRow({
      tableHeader: true,
      children: chunkColumns.map((column) => new TableCell({
        children: [
          new Paragraph({ children: [new TextRun({ text: column.charAt(0).toUpperCase() + column.slice(1), bold: true })] }),
        ],
      })),
    });

    const dataRows = rows.map((row) => new TableRow({
      children: chunkColumns.map((column) => new TableCell({
        children: [new Paragraph({ children: [new TextRun(String(row[column] ?? ""))] })],
      })),
    }));

    sections.push(new Table({
      width: {
        size: 100,
        type: WidthType.PERCENTAGE,
      },
      rows: [header, ...dataRows],
    }));
    sections.push(new Paragraph({ children: [new TextRun("")] }));
  }

  return sections;
};

export const downloadSessionExportWord = async (
  sessionName: string,
  document: SessionExportDocument,
): Promise<void> => {
  const documentChildren: Array<Paragraph | Table> = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun(`SSC Assistant Export: ${document.session.name}`)],
    }),
    new Paragraph({ children: [new TextRun(`Session ID: ${document.session.id}`)] }),
    new Paragraph({ children: [new TextRun(`Exported at: ${new Date(document.exportedAt).toLocaleString()}`)] }),
    new Paragraph({ children: [new TextRun("")] }),
  ];

  for (const [index, message] of document.messages.entries()) {
    documentChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [
          new TextRun(`Message ${index + 1} - ${message.role.toUpperCase()} - ${formatTimestamp(message.timestamp)}`),
        ],
      }),
    );

    splitLines(message.renderedContent).forEach((line) => {
      documentChildren.push(lineToDocxParagraph(line));
    });

    if (message.mermaidDiagrams.length > 0) {
      documentChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Diagrams")] }));

      for (const diagram of message.mermaidDiagrams) {
        const renderedDiagram = await renderMermaidToImage(diagram, { pixelScale: 2 });
        if (!renderedDiagram) {
          documentChildren.push(new Paragraph({ children: [new TextRun("Mermaid diagram (code)")] }));
          splitLines(diagram.code).forEach((line) => {
            documentChildren.push(new Paragraph({ children: [new TextRun(line)] }));
          });
          continue;
        }

        const maxWidth = 560;
        const scaled = scaleToFit(
          renderedDiagram.width,
          renderedDiagram.height,
          maxWidth,
          320,
        );

        documentChildren.push(new Paragraph({
          children: [
            new ImageRun({
              data: renderedDiagram.pngBytes,
              transformation: {
                width: Math.round(scaled.width),
                height: Math.round(scaled.height),
              },
            }),
          ],
        }));
      }
    }

    if (message.mermaidDataRows.length > 0) {
      documentChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Data Grid")] }));
      const tableSections = buildWordTableSections(message.mermaidDataRows);
      documentChildren.push(...tableSections);
    }

    if (message.citationGroups.length > 0) {
      documentChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Sources")] }));
      message.citationGroups.forEach((group) => {
        documentChildren.push(new Paragraph({ children: [new TextRun(`[${group.displayNumber}] ${group.title}`)] }));
        documentChildren.push(new Paragraph({ children: [new TextRun(group.url)] }));
      });
    }

    if (message.attachments.length > 0) {
      documentChildren.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun("Attachments")] }));
      message.attachments.forEach((attachment) => {
        documentChildren.push(new Paragraph({ children: [new TextRun(`- ${attachment.originalName || attachment.blobName}`)] }));
        if (attachment.url) {
          documentChildren.push(new Paragraph({ children: [new TextRun(`  ${attachment.url}`)] }));
        }
      });
    }

    documentChildren.push(new Paragraph({ children: [new TextRun("")] }));
  }

  const wordDocument = new Document({
    sections: [
      {
        children: documentChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(wordDocument);
  triggerDownload(
    blob,
    buildSessionExportFileName(sessionName, "word"),
  );
};
