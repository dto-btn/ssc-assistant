/**
 * FileUpload component
 *
 * Handles file selection and upload UI inside the playground. Integrates with
 * the app's upload endpoint and shows progress/status to the user. Intended
 * for development/testing of file-based RAG flows.
 */

import React from "react";
import { IconButton, Tooltip } from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { useTranslation } from 'react-i18next';

/**
 * Props for {@link FileUpload}.
 *
 * @property onFiles - Callback invoked with the selected files. The component
 * does not persist state; the parent is responsible for handling/merging the
 * files and any subsequent upload flow.
 * @property disabled - When true, the attach button is disabled.
 */
interface FileUploadProps {
  onFiles: (files: FileList) => void;
  disabled?: boolean;
}

/**
 * Small, accessible file picker used inside the Playground chat bar.
 *
 * Features:
 * - Hidden <input type="file" multiple> controlled by a styled icon button
 * - Clears the input value after each selection so choosing the same file
 *   again still triggers onChange (common UX pitfall)
 * - Localized tooltip and aria-label
 *
 * This component is presentation-only and defers all state/upload handling to
 * the parent using the onFiles callback.
 */
const FileUpload: React.FC<FileUploadProps> = ({ onFiles, disabled }) => {
  const { t } = useTranslation('playground');
  const inputId = React.useId();
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        type="file"
        multiple
        hidden
        id={inputId}
        ref={inputRef}
        onChange={event => {
          // Forward files to parent, then clear the input so selecting the same
          // file again still triggers onChange (common UX pitfall)
          if (event.target.files) onFiles(event.target.files);
          if (inputRef.current) inputRef.current.value = "";
        }}
        aria-hidden
        tabIndex={-1}
      />
      <label htmlFor={inputId} style={{ display: 'inline-flex' }}>
        {/* Tooltip wraps a span to keep it enabled when the button is disabled */}
        <Tooltip title={t('attach')} enterDelay={300}>
          <span>
            <IconButton
              component="span"
              aria-label={t('attach')}
              size="medium"
              disabled={disabled}
              sx={{
                border: (theme) => `1px solid ${theme.palette.divider}`,
                bgcolor: (theme) => theme.palette.background.paper,
                '&:hover': {
                  bgcolor: (theme) => theme.palette.action.hover,
                },
              }}
            >
              <AttachFileIcon />
            </IconButton>
          </span>
        </Tooltip>
      </label>
    </>
  );
};

export default FileUpload;