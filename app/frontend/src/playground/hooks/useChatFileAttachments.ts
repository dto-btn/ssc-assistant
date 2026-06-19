/**
 * useChatFileAttachments
 *
 * Manages the file-attachment lifecycle for the chat composer:
 * - Attachment state (add, remove, deduplicate)
 * - Object-URL previews (created lazily, revoked automatically)
 * - Window-level drag-and-drop overlay
 * - Clipboard paste detection
 *
 * Extracted from ChatInput.tsx to keep the component focused on layout
 * and send orchestration.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppDispatch } from "../store/hooks";
import { addToast } from "../store/slices/toastSlice";
import { isSupportedFile } from "../supportedFileTypes";
import type React from "react";

export interface FilePreview {
  file: File;
  isImage: boolean;
  url: string | undefined;
}

export interface UseChatFileAttachmentsReturn {
  attachments: File[];
  previews: FilePreview[];
  dragActive: boolean;
  isUploading: boolean;
  uploadProgress: { completed: number; total: number };
  isUploadingRef: React.MutableRefObject<boolean>;
  handleFiles: (incoming: FileList | File[]) => void;
  handlePaste: (ev: React.ClipboardEvent) => void;
  removeAttachment: (index: number) => void;
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>;
  setIsUploading: React.Dispatch<React.SetStateAction<boolean>>;
  setUploadProgress: React.Dispatch<React.SetStateAction<{ completed: number; total: number }>>;
}

export function useChatFileAttachments(): UseChatFileAttachmentsReturn {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();

  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ completed: number; total: number }>({
    completed: 0,
    total: 0,
  });
  const isUploadingRef = useRef(false);
  const dragDepthRef = useRef(0);

  // Keep the ref in sync with state so callbacks can read without stale closures.
  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  /**
   * Derived preview URLs for image attachments. Non-image files are represented
   * by filename chips. Blob URLs are revoked when attachments/previews change
   * or on unmount.
   */
  const previews = useMemo<FilePreview[]>(() => {
    return attachments.map((file) => {
      const isImage =
        file.type.startsWith("image/") ||
        /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(file.name);
      return { file, isImage, url: isImage ? URL.createObjectURL(file) : undefined };
    });
  }, [attachments]);

  useEffect(() => {
    return () => {
      previews.forEach((p) => p.url && URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  /**
   * Adds files to the attachment list, deduplicating by name/size/lastModified.
   * Shows a toast for unsupported file types.
   */
  const handleFiles = useCallback(
    (incoming: FileList | File[]) => {
      if (isUploadingRef.current) return;
      const files = Array.isArray(incoming) ? incoming : Array.from(incoming);
      if (!files.length) return;

      const partitioned = files.reduce(
        (acc, file) => {
          if (isSupportedFile(file)) {
            acc.supported.push(file);
          } else {
            acc.unsupported.push(file);
          }
          return acc;
        },
        { supported: [] as File[], unsupported: [] as File[] },
      );

      if (partitioned.unsupported.length) {
        dispatch(
          addToast({
            message: t("errors.unsupportedFileType", {
              defaultValue:
                "Some files are not supported. Please upload PDF, Word (.doc/.docx), Excel (.xls/.xlsx), PowerPoint (.ppt/.pptx), CSV/TSV, or plain text files.",
            }),
            isError: true,
          }),
        );
      }

      if (!partitioned.supported.length) return;

      setAttachments((prev) => {
        const key = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
        const existing = new Set(prev.map(key));
        const toAdd = partitioned.supported.filter((f) => !existing.has(key(f)));
        const next = toAdd.length ? [...prev, ...toAdd] : prev;
        if (toAdd.length) {
          dispatch(
            addToast({
              message: `${toAdd.length} ${t("files.attached", { defaultValue: "files attached" })}`,
              isError: false,
            }),
          );
        }
        return next;
      });
    },
    [dispatch, t],
  );

  /**
   * Intercepts paste events to capture pasted file data (e.g. screenshots).
   */
  const handlePaste = useCallback(
    (ev: React.ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const f = item.getAsFile();
          if (f) {
            handleFiles([f]);
            ev.preventDefault();
            break;
          }
        }
      }
    },
    [handleFiles],
  );

  /**
   * Window-level drag-and-drop: shows a full-viewport overlay while dragging,
   * adds dropped files to the attachment list. Cleaned up on unmount.
   */
  useEffect(() => {
    const hasFiles = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      return !!types && Array.from(types).includes("Files");
    };

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current += 1;
      setDragActive(true);
      e.preventDefault();
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) setDragActive(false);
      e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      if (e.dataTransfer?.files?.length) {
        handleFiles(e.dataTransfer.files);
      }
      dragDepthRef.current = 0;
      setDragActive(false);
      e.preventDefault();
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  const removeAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    attachments,
    previews,
    dragActive,
    isUploading,
    uploadProgress,
    isUploadingRef,
    handleFiles,
    handlePaste,
    removeAttachment,
    setAttachments,
    setIsUploading,
    setUploadProgress,
  };
}
