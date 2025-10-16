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

function isImageAttachment(attachment: FileAttachment): boolean {
  if (attachment.contentType?.toLowerCase().startsWith("image/")) return true;
  return imageExtensions.test(attachment.originalName);
}

function isPdfAttachment(attachment: FileAttachment): boolean {
  if (attachment.contentType?.toLowerCase() === "application/pdf") return true;
  return pdfExtensions.test(attachment.originalName);
}

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

function formatUploadedAt(uploadedAt?: string | null): string {
  if (!uploadedAt) return "";
  const date = new Date(uploadedAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ attachments }) => {
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <Stack direction="row" spacing={1.5} flexWrap="wrap" sx={{ mt: 1 }}>
      {attachments.map((attachment) => {
        const key = attachment.blobName || attachment.url || attachment.originalName;
        const isImage = isImageAttachment(attachment);
        const isPdf = !isImage && isPdfAttachment(attachment);
        const sizeLabel = formatBytes(attachment.size);
        const timestampLabel = formatUploadedAt(attachment.uploadedAt);

        return (
          <Paper
            key={key}
            variant="outlined"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              p: 1.25,
              minWidth: 220,
              maxWidth: 340,
            }}
          >
            {isImage ? (
              <Box
                component="img"
                src={attachment.url}
                alt={attachment.originalName}
                sx={{
                  width: 72,
                  height: 72,
                  objectFit: "cover",
                  borderRadius: 1,
                  border: (theme) => `1px solid ${theme.palette.divider}`,
                }}
              />
            ) : (
              <Avatar
                variant="rounded"
                sx={{ bgcolor: (theme) => theme.palette.grey[100], color: "inherit" }}
              >
                {isPdf ? <PictureAsPdfIcon color="error" /> : <InsertDriveFileIcon fontSize="small" />}
              </Avatar>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Link
                href={attachment.url}
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontWeight: 500 }}
              >
                {isImage ? <ImageIcon fontSize="inherit" /> : null}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {attachment.originalName}
                </span>
              </Link>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {[sizeLabel, timestampLabel].filter(Boolean).join(" • ")}
              </Typography>
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
};

export default AttachmentPreview;
