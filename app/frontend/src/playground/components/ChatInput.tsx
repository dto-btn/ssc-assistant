/**
 * ChatInput component (Playground)
 *
 * Updated to match the main app's ChatInput look-and-feel while keeping
 * the playground's Redux flow. Includes:
 * - Sticky footer container with rounded bordered input
 * - File attach via button, drag-and-drop anywhere, and paste
 * - Inline file preview with remove action
 * - Accessible controls and keyboard behavior (Enter to send, Shift+Enter newline)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { setIsLoading } from "../store/slices/chatSlice";
import {
  Box,
  Paper,
  IconButton,
  Container,
  InputBase,
  Typography,
  CircularProgress,
  Chip,
  useTheme,
} from "@mui/material";
import FileUpload from "./FileUpload";
import { addToast } from "../store/slices/toastSlice";
import { RootState } from "../store";
import { clearQuotedText } from "../store/slices/quotedSlice";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import InfoIcon from "@mui/icons-material/Info";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import isFeatureEnabled from "../FeatureGate";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";
import { createPortal } from "react-dom";

/**
 * Props for the Playground ChatInput component.
 *
 * @property sessionId - Unique identifier used to group the conversation in the
 * playground store and correlate user/assistant messages.
 */
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { uploadEncodedFile } from "../api/storage";
import { addUserFileToOutbox } from "../store/slices/outboxSlice";
import { upsertSessionFile } from "../store/slices/sessionFilesSlice";
import { FileAttachment } from "../types";

interface ChatInputProps {
  sessionId: string;
}

/**
 * Chat input and composer for the Playground.
 *
 * Responsibilities:
 * - Compose text messages with Enter/Shift+Enter behavior
 * - Attach files via button, drag-and-drop anywhere, or paste
 * - Preview and remove attachments inline
 * - Display quoted text being replied to and allow clearing it
 * - Mirror the main app look-and-feel while using the playground Redux flow
 *
 * Accessibility:
 * - Input is labeled and announces validation errors via aria-describedby
 * - Drag overlay is visual-only with pointer-events disabled to avoid trapping focus
 *
 * Performance:
 * - Image previews use object URLs which are revoked on cleanup
 *
 * @param props - {@link ChatInputProps}
 * @returns A sticky footer chat composer UI for the Playground.
 */
const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  // i18n + theme
  const { t } = useTranslation('playground');
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const quotedText = useAppSelector((state: RootState) => state.quoted.quotedText);
  const isLoading = useAppSelector((state: RootState) => state.chat.isLoading);

  // Local UI state
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dragDepthRef = useRef(0);
  const accessToken = useAppSelector((state: RootState) => state.auth.accessToken);

  /**
   * Upper bound for message length enforced client-side. Keep this aligned with
   * backend constraints to provide fast feedback to the user.
   */
  const MAX_INPUT_LENGTH = 24000;

  /**
   * Derived preview URLs for image attachments. Non-image files are represented
   * by filename chips. Blob URLs are revoked when attachments/previews change
   * or on unmount (see cleanup effect below).
   */
  const previews = useMemo(() => {
    return attachments.map((file) => {
      const isImage = file.type.startsWith("image/") || /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(file.name);
      return { file, isImage, url: isImage ? URL.createObjectURL(file) : undefined };
    });
  }, [attachments]);

  useEffect(() => {
    return () => {
      // cleanup object URLs
      previews.forEach(p => p.url && URL.revokeObjectURL(p.url));
    };
  }, [previews]);

  // Focus input when a quote is added
  useEffect(() => {
    if (quotedText) {
      inputRef.current?.focus();
    }
  }, [quotedText]);

  /**
   * Adds selected/dropped/pasted files to the local attachments list and shows
   * a toast with the count. Merges with any existing attachments.
   *
   * @param fileList - A FileList from input/drag events, or an array of Files from paste handlers.
   */
  const handleFiles = useCallback((incoming: FileList | File[]) => {
    // Normalize the input into a File[]
    const files = Array.isArray(incoming) ? incoming : Array.from(incoming);
    if (!files.length) return;
    setAttachments((prev) => {
      // Deduplicate by name/size/lastModified
      const key = (f: File) => `${f.name}|${f.size}|${f.lastModified}`;
      const existing = new Set(prev.map(key));
      const toAdd = files.filter((f) => !existing.has(key(f)));
      const next = toAdd.length ? [...prev, ...toAdd] : prev;
      if (toAdd.length) {
        dispatch(addToast({ message: `${toAdd.length} ${t('files.attached', { defaultValue: 'files attached' })}` , isError: false }));
      }
      return next;
    });
  }, [dispatch, t]);

  /**
   * Intercepts paste events to capture pasted file data (e.g., screenshots) as
   * attachments. Prevents default paste when a file is detected to avoid
   * inserting binary data or base64 text into the input.
   */
  const handlePaste = useCallback((ev: React.ClipboardEvent) => {
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
  }, [handleFiles]);

  // Drag-and-drop anywhere overlay
  /**
   * Window-level drag events allow dropping files anywhere. We highlight the
   * composer with an overlay while dragging, and add dropped files to the
   * attachments list. Event listeners are cleaned up on unmount.
   */
  useEffect(() => {
    // Window-level handlers enable drag-drop anywhere on the page
    const hasFiles = (e: DragEvent) => {
      const types = e.dataTransfer?.types;
      return !!types && (Array.from(types).includes('Files'));
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

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
    };
  }, [handleFiles]);

  /**
   * Removes a single attachment at the provided index. Blob URL cleanup is
   * handled by the previews cleanup effect.
   *
   * @param index - The zero-based index of the attachment to remove.
   */
  const removeAttachment = useCallback((index: number) => {
    // Removal triggers preview cleanup via the previews effect above
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * Submits the current message to the chat store including any quoted text and
   * attachments, then resets the composer state. Guarded against empty input
   * and current validation errors.
   */
  const handleSend = useCallback(async () => {
    if (!input.trim() && attachments.length === 0) return;

    const messageContent = quotedText ? `> ${quotedText}\n\n${input}` : input;
    let uploadedFiles: FileAttachment[] = [];

    if (attachments.length) {
      let filesWithDataUrl: { file: File; dataUrl: string }[] = [];
      try {
        filesWithDataUrl = await Promise.all(
          attachments.map(async (file) => ({
            file,
            dataUrl: await fileToDataUrl(file),
          }))
        );
      } catch {
        dispatch(
          addToast({
            message: t("errors.readFailed", { defaultValue: "Failed to read one of the files." }),
            isError: true,
          })
        );
        return;
      }

      if (!accessToken) {
        filesWithDataUrl.forEach(({ file, dataUrl }) =>
          dispatch(addUserFileToOutbox({ originalName: file.name, dataUrl }))
        );
        dispatch(
          addToast({
            message: t("auth.tokenRequired", { defaultValue: "Sign in to upload files. Files were queued for later." }),
            isError: true,
          })
        );
        setAttachments([]);
        return;
      }

      const successes: FileAttachment[] = [];
      const failedUploads: { file: File; dataUrl: string; error: unknown }[] = [];

      for (const { file, dataUrl } of filesWithDataUrl) {
        try {
          const uploaded = await uploadEncodedFile({
            encodedFile: dataUrl,
            originalName: file.name,
            accessToken,
            sessionId,
            category: "files",
            metadata: {
              originalname: file.name,
              uploadedat: new Date().toISOString(),
            },
          });
          successes.push(uploaded);
          dispatch(upsertSessionFile({ sessionId, file: uploaded }));
        } catch (error) {
          failedUploads.push({ file, dataUrl, error });
        }
      }

      if (failedUploads.length) {
        failedUploads.forEach(({ file, dataUrl }) =>
          dispatch(addUserFileToOutbox({ originalName: file.name, dataUrl }))
        );
        const failureMessage =
          failedUploads.length === attachments.length
            ? t("errors.uploadFailed", { defaultValue: "Failed to upload files. They were queued for retry." })
            : t("errors.partialUpload", { defaultValue: "Some files failed to upload and were queued for retry." });
        dispatch(addToast({ message: failureMessage, isError: true }));
      }

      uploadedFiles = successes;
    }

    await (dispatch as unknown as (thunk: unknown) => Promise<void>)(
      sendAssistantMessage({
        sessionId,
        content: messageContent,
        attachments: uploadedFiles.length ? uploadedFiles : undefined,
      })
    );

    setInput("");
    setAttachments([]);
    if (quotedText) {
      dispatch(clearQuotedText());
    }
  }, [input, attachments, quotedText, dispatch, sessionId, accessToken, t]);

  /**
   * Keyboard behavior: Enter sends the message, Shift+Enter inserts a newline.
   */
  const handleKeyDown = useCallback((ev: React.KeyboardEvent) => {
    // Avoid sending while composing IME text
    if (ev.nativeEvent?.isComposing) return;
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ev.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  /**
   * Best-effort stop action to end the current generation. This toggles the
   * loading state but does not cancel an in-flight network request in the
   * playground.
   */
  const onStop = useCallback(() => {
    // Best-effort stop: toggle loading off. In real app this would cancel request.
    dispatch(setIsLoading(false));
  }, [dispatch]);

  /** Whether the input should act in a busy/disabled state (mirrors main app). */
  const disabled = isLoading; // mirror main app behavior

  return (
    <Container
      component="footer"
      sx={{
        position: "sticky",
        bottom: 0,
        boxShadow: `0px -15px 20px ${theme.palette.background.default}`,
        pt: 1,
        pb: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* Quoted text banner */}
      {quotedText && (
        <Paper
          role="note"
          aria-label={t('quote.this.message', { defaultValue: 'This message' })}
          sx={{
            p: 1,
            mb: 0,
            borderRadius: "30px 30px 0 0",
            borderColor: theme.palette.primary.main,
            borderWidth: "1px 1px 0 1px",
            borderStyle: "solid",
            bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
          }}
        >
          <Box display="flex" alignItems="center">
            <Box flex={1} component="blockquote" sx={{ m: 0, fontStyle: 'italic' }}>{quotedText}</Box>
            <IconButton
              onClick={() => dispatch(clearQuotedText())}
              size="small"
              aria-label={t('cancel', { defaultValue: 'Cancel' })}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Paper>
      )}

      {/* File preview panel */}
      {attachments.length > 0 && (
        <Paper
          sx={{
            p: "2px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "left",
            borderRadius: quotedText ? "0 0 0 0" : "30px 30px 0 0",
            borderColor: theme.palette.primary.main,
            borderWidth: "1px 1px 0 1px",
            borderStyle: "solid",
            flexWrap: 'wrap',
            gap: 1,
          }}
          aria-label={t('attachments', { defaultValue: 'Attachments' })}
        >
          {previews.map((p, idx) => (
            <Box key={`${p.file.name}-${idx}`} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 0.5 }}>
              {p.isImage ? (
                <Box
                  component="img"
                  src={p.url}
                  alt={p.file.name}
                  sx={{ maxHeight: 110, borderRadius: 2, display: 'block' }}
                />
              ) : (
                <Chip icon={<AttachFileIcon />} label={p.file.name} variant="outlined" />
              )}
              <IconButton
                onClick={() => removeAttachment(idx)}
                aria-label={t('delete', { defaultValue: 'Delete' })}
                size="small"
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
        </Paper>
      )}

      {/* Input row */}
      <Paper
        component="form"
        onSubmit={(e) => { e.preventDefault(); handleSend(); }}
        sx={{
          p: "2px 5px",
          display: "flex",
          alignItems: "center",
          borderRadius: attachments.length > 0 || quotedText ? "0 0 30px 30px" : "40px",
          borderColor: dragActive ? theme.palette.secondary.main : theme.palette.primary.main,
          borderWidth: attachments.length > 0 || quotedText ? "0 1px 1px 1px" : "1px",
          borderStyle: "solid",
          background: dragActive ? theme.palette.action.hover : undefined,
          transition: "background 0.2s, border-color 0.2s",
          minHeight: 60,
        }}
        aria-describedby={error ? 'chatinput-error' : undefined}
      >
        {isFeatureEnabled('FileUpload') && (
          <Box sx={{ ml: 0.5 }}>
            <FileUpload onFiles={(files) => handleFiles(files)} disabled={disabled} />
          </Box>
        )}

        <InputBase
          inputRef={inputRef}
          sx={{ ml: 1, flex: 1 }}
          placeholder={t('type.a.message', { defaultValue: 'Type a message' })}
          // Avoid conflicting tabIndex by providing a single source of truth
          inputProps={{ 'aria-label': t('type.a.message', { defaultValue: 'Type a message' }), tabIndex: 0 }}
          value={input}
          multiline
          maxRows={15}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const v = e.target.value;
            // Simple length validation with i18n fallback
            if (v.length > MAX_INPUT_LENGTH) setError(t('errors.tooLong', { defaultValue: 'Message is too long' })); else setError(null);
            setInput(v);
          }}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          id="playground-ask-question"
        />

        {/** Disable when there's nothing to send; keep enabled while loading to allow Stop */}
        <IconButton
          onClick={disabled ? onStop : handleSend}
          disabled={!isLoading && !(input.trim().length > 0 || attachments.length > 0)}
          sx={{ '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' } }}
          aria-label={disabled ? t('stop', { defaultValue: 'Stop' }) : t('send', { defaultValue: 'Send' })}
          size="large"
          id="send-or-stop-question-button"
        >
          {disabled ? (
            <Box sx={{ position: 'relative', display: 'inline-flex' }}>
              <CircularProgress size={30} aria-label={t('stop', { defaultValue: 'Stop' })} />
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StopCircleIcon sx={{ color: 'primary.main' }} />
              </Box>
            </Box>
          ) : (
            <SendIcon sx={{ color: 'primary.main' }} />
          )}
        </IconButton>
      </Paper>

      {/* Footer helper text */}
      <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', gap: 1, alignItems: 'center', py: 1 }}>
        <InfoIcon fontSize="inherit" color="info" />
        <Typography variant="body2" color="text.secondary">
          {t('ai.disclaimer', { defaultValue: 'AI may make mistakes' })}
        </Typography>
      </Box>

      {/* Drag overlay */}
      {dragActive && createPortal(
        <Box
          sx={{
            // Use fixed to reliably cover the viewport regardless of layout
            position: 'fixed',
            left: 0,
            top: 0,
            width: '100vw',
            height: '100vh',
            bgcolor: theme.palette.background.paper,
            border: `3px dashed ${theme.palette.primary.main}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Overlay is non-interactive so it doesn't trap pointer/focus
            pointerEvents: 'none',
            fontWeight: 600,
            fontSize: 18,
            zIndex: 9999,
            opacity: 0.85,
            color: theme.palette.primary.main,
            flexDirection: 'column',
            gap: 1,
          }}
        >
          <AttachFileIcon sx={{ borderRadius: '10%', backgroundColor: theme.palette.background.paper, p: 1.25, boxShadow: `0 0 5px ${theme.palette.secondary.main}`, mb: 1.25, fontSize: 64, color: theme.palette.secondary.main }} />
          <Typography fontSize="24px">{t('drop.file.to.upload', { defaultValue: 'Drop file to upload' })}</Typography>
        </Box>,
        document.body
      )}

      {error && (
        <Typography id="chatinput-error" variant="caption" color="error" sx={{ display: 'block', textAlign: 'center', pt: 0.5 }} aria-live="polite">
          {error}
        </Typography>
      )}
    </Container>
  );
};

export default ChatInput;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}