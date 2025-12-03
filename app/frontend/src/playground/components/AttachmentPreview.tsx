import React from "react";
import { Avatar, Box, Link, Paper, Stack, Typography } from "@mui/material";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import ImageIcon from "@mui/icons-material/Image";
import { FileAttachment } from "../types";

interface AttachmentPreviewProps {
  attachments: FileAttachment[];
}

const imageExtensions = /(\.(png|jpe?g|gif|bmp|webp|svg))$/i;
const pdfExtensions = /(\.pdf)$/i;

/**
 * Determine if the attachment should be rendered inline as an image preview.
 */
function isImageAttachment(attachment: FileAttachment): boolean {
  if (attachment.contentType?.toLowerCase().startsWith("image/")) return true;
  return imageExtensions.test(attachment.originalName);
}

/**
 * Helper that determines whether the attachment should show the PDF-specific iconography.
 */
function isPdfAttachment(attachment: FileAttachment): boolean {
  if (attachment.contentType?.toLowerCase() === "application/pdf") return true;
  return pdfExtensions.test(attachment.originalName);
}

/**
 * Pick a readable download file name even when the blob metadata lacks the original label.
 */
function deriveDownloadName(attachment: FileAttachment): string | undefined {
  if (attachment.originalName) {
    return attachment.originalName;
  }

  const blobSegment = attachment.blobName?.split("/").pop() ?? "";
  if (!blobSegment) {
    return undefined;
  }

  const trimmed = blobSegment.replace(/^[0-9a-f]{32}_/i, "");
  return trimmed || blobSegment;
}

/**
 * Format raw byte lengths into a compact label suitable for secondary metadata.
 */
function formatBytes(size?: number): string {
  if (typeof size !== "number" || Number.isNaN(size)) return "";
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"]; // unlikely to exceed GB for chat attachments
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Render the upload timestamp in the user's locale, falling back gracefully on invalid dates.
 */
function formatUploadedAt(uploadedAt?: string | null): string {
  if (!uploadedAt) return "";
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

/**
 * Render a visual summary for chat attachments so users can inspect uploaded
 * files directly inside the transcript.
 */
const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
      {attachments.map((attachment) => {
        const previewUrl = attachment.previewUrl || attachment.url;
        const key = attachment.blobName || previewUrl || attachment.originalName;
        const isImage = isImageAttachment(attachment);
        const isPdf = !isImage && isPdfAttachment(attachment);
        const sizeLabel = formatBytes(attachment.size);
        const timestampLabel = formatUploadedAt(attachment.uploadedAt);
        const canRenderImagePreview = isImage && Boolean(previewUrl);
        const downloadName = deriveDownloadName(attachment);

        return (
          <Paper
            key={key}
            variant="outlined"
            sx={{
              display: "flex",
              gap: 1.5,
              p: 1.5,
              width: { xs: "100%", sm: "min(420px, 100%)" },
              maxWidth: "100%",
              alignItems: canRenderImagePreview ? "stretch" : "center",
            }}
          >
            {canRenderImagePreview ? (
              <Box
                component="img"
                src={previewUrl}
                alt={attachment.originalName}
                sx={{
                  width: 64,
                  height: 64,
                  objectFit: "cover",
                  borderRadius: 1,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                  flexShrink: 0,
                }}
              />
            ) : (
              <Avatar
                variant="rounded"
                sx={{
                  width: 64,
                  height: 64,
                  flexShrink: 0,
                  bgcolor: (theme) => theme.palette.grey[100],
                  color: (theme) => theme.palette.text.secondary,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              >
                {isPdf ? <PictureAsPdfIcon color="error" /> : <InsertDriveFileIcon fontSize="small" />}
              </Avatar>
            )}
            <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
              <Link
                href={previewUrl || attachment.url}
                download={downloadName}
                underline="hover"
                sx={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 0.75,
                  fontWeight: 600,
                  color: "text.primary",
                  maxWidth: "100%",
                }}
              >
                {canRenderImagePreview ? <ImageIcon fontSize="small" /> : null}
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    fontWeight: "inherit",
                    lineHeight: 1.4,
                    overflowWrap: "anywhere",
                    wordBreak: "break-word",
                    maxWidth: "100%",
                  }}
                >
                  {attachment.originalName || "Attachment"}
                </Typography>
              </Link>
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ color: "text.secondary" }}>
                {[sizeLabel, timestampLabel]
                  .filter(Boolean)
                  .map((label, index) => (
                    <Typography key={`${key}-meta-${index}`} variant="caption" component="span">
                      {label}
                    </Typography>
                  ))}
              </Stack>
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
};

export default AttachmentPreview;
