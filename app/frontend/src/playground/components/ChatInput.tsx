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

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Paper,
  IconButton,
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
import { sendAssistantMessage, stopAssistantMessage } from "../store/thunks/assistantThunks";
import { createPortal } from "react-dom";

/**
 * Props for the Playground ChatInput component.
 *
 * @property sessionId - Unique identifier used to group the conversation in the
 * playground store and correlate user/assistant messages.
 */
import { useTranslation } from 'react-i18next';
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { isRetriableUploadError, uploadEncodedFile } from "../api/storage";
import { addUserFileToOutbox } from "../store/slices/outboxSlice";
import { upsertSessionFile } from "../store/slices/sessionFilesSlice";
import { FileAttachment } from "../types";
import { useChatFileAttachments } from "../hooks/useChatFileAttachments";


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
  const isLoading = useAppSelector((state: RootState) => state.chat.isLoadingBySessionId[sessionId] ?? false);

  // File attachment state managed by dedicated hook
  const {
    attachments,
    previews,
    dragActive,
    isUploading,
    uploadProgress,
    handleFiles,
    handlePaste,
    removeAttachment,
    setAttachments,
    setIsUploading,
    setUploadProgress,
  } = useChatFileAttachments();

  // Local UI state
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const accessToken = useAppSelector((state: RootState) => state.auth.accessToken);


  /**
   * Upper bound for message length enforced client-side. Keep this aligned with
   * backend constraints to provide fast feedback to the user.
   */
  const MAX_INPUT_LENGTH = 24000;


  // Focus input when a quote is added
  useEffect(() => {
    if (quotedText) {
      inputRef.current?.focus();
    }
  }, [quotedText]);


  /**
   * Submits the current message to the chat store including any quoted text and
   * attachments, then resets the composer state. Guarded against empty input
   * and current validation errors.
   */
  const handleSend = useCallback(async () => {
    if (isLoading || isUploading) return;
    if (!input.trim() && attachments.length === 0) return;

    const messageContent = quotedText ? `> ${quotedText}\n\n${input}` : input;
    let uploadedFiles: FileAttachment[] = [];

    if (attachments.length) {
      setIsUploading(true);
      setUploadProgress({ completed: 0, total: attachments.length });
      try {
        type PreparedFile = { file: File; dataUrl: string; metadata: Record<string, string> };
        let filesWithDataUrl: PreparedFile[] = [];
        try {
          filesWithDataUrl = await Promise.all(
            attachments.map(async (file) => ({
              file,
              dataUrl: await fileToDataUrl(file),
              metadata: {
                originalname: file.name,
                uploadedat: new Date().toISOString(),
              } as Record<string, string>,
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
          filesWithDataUrl.forEach(({ file, dataUrl, metadata }) =>
            dispatch(
              addUserFileToOutbox({
                originalName: file.name,
                dataUrl,
                sessionId,
                metadata,
              })
            )
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
        const failedUploads: { file: File; dataUrl: string; metadata: Record<string, string>; error: unknown }[] = [];

        for (const { file, dataUrl, metadata } of filesWithDataUrl) {
          try {
            const uploaded = await uploadEncodedFile({
              encodedFile: dataUrl,
              originalName: file.name,
              accessToken,
              sessionId,
              category: "files",
              metadata,
            });
            successes.push(uploaded);
            dispatch(upsertSessionFile({ sessionId, file: uploaded }));
          } catch (error) {
            failedUploads.push({ file, dataUrl, metadata, error });
          } finally {
            setUploadProgress((prev) => ({
              completed: Math.min(prev.completed + 1, prev.total),
              total: prev.total,
            }));
          }
        }

        if (failedUploads.length) {
          const retriableFailures = failedUploads.filter(({ error }) => isRetriableUploadError(error));
          retriableFailures.forEach(({ file, dataUrl, metadata }) =>
            dispatch(
              addUserFileToOutbox({
                originalName: file.name,
                dataUrl,
                sessionId,
                metadata,
              })
            )
          );

          const failureMessage =
            retriableFailures.length === 0
              ? t("errors.uploadFailed", { defaultValue: "Failed to upload files." })
              : failedUploads.length === attachments.length
                ? t("errors.uploadFailed", { defaultValue: "Failed to upload files. They were queued for retry." })
                : t("errors.partialUpload", { defaultValue: "Some files failed to upload and were queued for retry." });
          dispatch(addToast({ message: failureMessage, isError: true }));
        }

        uploadedFiles = successes;
      } finally {
        setIsUploading(false);
        setUploadProgress({ completed: 0, total: 0 });
      }
    }

    await dispatch(
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
  }, [input, attachments, quotedText, dispatch, sessionId, accessToken, t, isLoading, isUploading]);

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
    stopAssistantMessage(sessionId);
  }, [sessionId]);

  /** Whether the input should act in a busy/disabled state (mirrors main app). */
  const composerBusy = isLoading || isUploading; // also disable while uploads are pending
  const canSend = input.trim().length > 0 || attachments.length > 0;

  return (
    <Box
      component="footer"
      sx={{
        position: "sticky",
        bottom: 0,
        boxShadow: `0px -15px 20px ${theme.palette.background.default}`,
        pt: 0.5,
        pb: 'env(safe-area-inset-bottom)',
        width: "100%",
        maxWidth: "100%",
        maxHeight: 130,
        overflow: 'hidden',
        px: { xs: 0.5, sm: 1 },
        boxSizing: "border-box",
        mx: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: 0.2,
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
            minWidth: 0,
            borderRadius: "30px 30px 0 0",
            borderColor: theme.palette.primary.main,
            borderWidth: "1px 1px 0 1px",
            borderStyle: "solid",
            bgcolor: theme.palette.mode === 'dark' ? 'background.default' : 'grey.50',
          }}
        >
          <Box display="flex" alignItems="center" minWidth={0}>
            <Box flex={1} component="blockquote" sx={{ m: 0, fontStyle: 'italic', minWidth: 0 }}>{quotedText}</Box>
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
            minWidth: 0,
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
          p: "0.25rem 0.75rem",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          borderRadius: attachments.length > 0 || quotedText ? "0 0 28px 28px" : "32px",
          borderColor: dragActive ? theme.palette.secondary.main : theme.palette.primary.main,
          borderWidth: attachments.length > 0 || quotedText ? "0 1px 1px 1px" : "1px",
          borderStyle: "solid",
          background: dragActive ? theme.palette.action.hover : undefined,
          transition: "background 0.2s, border-color 0.2s",
          minHeight: 40,
          maxHeight: 78,
          overflow: 'hidden',
        }}
        aria-describedby={error ? 'chatinput-error' : undefined}
      >
        {isFeatureEnabled('FileUpload') && (
          <Box sx={{ ml: 0.5 }}>
            <FileUpload onFiles={(files) => handleFiles(files)} disabled={composerBusy} />
          </Box>
        )}

        {/* Visually-hidden label associates the input with a real <label> element
            so screen readers announce the field correctly without a visible placeholder. */}
        <Box
          component="label"
          htmlFor="playground-ask-question"
          sx={{
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
        >
          {t('type.a.message', { defaultValue: 'Type a message' })}
        </Box>

        <InputBase
          inputRef={inputRef}
          sx={{ ml: 1, flex: 1, minWidth: 0, maxHeight: 64, overflowY: 'auto', lineHeight: 1.2, fontSize: '0.86rem', py: 0.3 }}
          // The visually-hidden <label htmlFor="playground-ask-question"> above
          // provides a label association. Add a persistent aria-label for
          // assistive tech and to satisfy the accessible name requirements.
          inputProps={{
            tabIndex: 0,
            'aria-label': t('type.a.message', { defaultValue: 'Your message' }),
          }}
          value={input}
          multiline
          minRows={1}
          maxRows={3}
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

        {/** Disable when there's nothing to send; show stop or upload states when busy */}
        <IconButton
          type="button"
          onClick={isLoading ? onStop : handleSend}
          disabled={isUploading || (!isLoading && !canSend)}
          sx={{
            minWidth: 38,
            minHeight: 38,
            borderRadius: '50%',
            transition: 'background-color 0.2s ease, color 0.2s ease, transform 0.2s ease',
            color: canSend && !isLoading && !isUploading ? 'primary.main' : 'text.secondary',
            '&:hover': canSend && !isLoading && !isUploading ? {
              bgcolor: 'primary.main',
              color: 'common.white',
              transform: 'translateY(-1px)',
            } : {
              bgcolor: 'action.hover',
              color: 'text.secondary',
            },
            '&:focus-visible': {
              outline: `3px solid ${theme.palette.primary.main}`,
              outlineOffset: 3,
            },
          }} 
          aria-label={
            isLoading
              ? t('stop', { defaultValue: 'Stop' })
              : isUploading
                ? t('files.uploading', { defaultValue: 'Uploading files' })
                : t('send', { defaultValue: 'Send' })
          }
          size="large"
          id="send-or-stop-question-button"
        >
          {isUploading ? (
            <Box sx={{ position: 'relative', display: 'inline-flex' }} aria-hidden="true">
              <CircularProgress
                size={30}
                sx={{
                  // Scale down on very small viewports
                  '@media (max-width: 360px)': { width: '24px !important', height: '24px !important' },
                }}
              />
            </Box>
          ) : isLoading ? (
            <Box sx={{ position: 'relative', display: 'inline-flex' }} aria-hidden="true">
              <CircularProgress
                size={30}
                sx={{
                  '@media (max-width: 360px)': { width: '24px !important', height: '24px !important' },
                }}
              />
              <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <StopCircleIcon sx={{ color: 'primary.main' }} />
              </Box>
            </Box>
          ) : (
            <SendIcon
              aria-hidden="true"
            />
          )}
        </IconButton>
        {/*
          Visually-hidden live region — announces button-state transitions
          (e.g. "Stop", "Uploading files") to screen readers without duplicating
          visible text. Satisfies WCAG 4.1.3 (Status Messages).
        */}
        <Box
          component="span"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          sx={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            clipPath: 'inset(50%)',
            whiteSpace: 'nowrap',
          }}
        >
          {isLoading
            ? t('stop', { defaultValue: 'Stop' })
            : isUploading
              ? t('files.uploading', { defaultValue: 'Uploading files' })
              : null}
        </Box>
      </Paper>

      {error && (
        <Typography
          id="chatinput-error"
          role="alert"
          variant="caption"
          color="error"
          sx={{ px: 2, pt: 0.5, display: 'block' }}
        >
          {error}
        </Typography>
      )}

      {isUploading && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            justifyContent: 'center',
            width: '100%',
            py: 1,
          }}
        >
          <CircularProgress size={18} thickness={5} />
          <Typography variant="body2" color="text.secondary">
            {t('files.uploadingProgress', {
              defaultValue: 'Uploading files... {{completed}}/{{total}}',
              completed: uploadProgress.completed,
              total: uploadProgress.total,
            })}
          </Typography>
        </Box>
      )}

      {/* Footer helper text */}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          gap: 0.4,
          alignItems: 'center',
          py: 0.25,
          px: 0.5,
          minHeight: 22,
          maxHeight: 22,
          overflow: 'hidden',
        }}
      >
        <InfoIcon fontSize="small" color="info" sx={{ transform: 'scale(0.85)' }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.1, fontSize: '0.72rem' }}>
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
    </Box>
  );
};

export default ChatInput;

/**
 * Read a File into a base64 data URL so uploads can be routed through the
 * playground API without duplicating FileReader logic.
 */
async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}