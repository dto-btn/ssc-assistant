import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useRef, useState, useCallback } from "react";
import { MenuItem } from '@mui/material';
import { StyledIconButton } from './StyledIconButton';
import { type ValidFileTypeDefinition } from './validFiletypeDefinitions';
import { useFileUploadManager } from './useFileUploadManager';

interface UploadFileButtonProps {
  disabled: boolean;
  onFileUpload: (file: Attachment) => void;
  icon: React.ReactNode;
  fileTypes: ValidFileTypeDefinition[];
  label: string; // Optional label for the button
}

export function UploadFileButtonMenuItem({
  disabled,
  onFileUpload,
  icon,
  fileTypes,
  label
}: UploadFileButtonProps) {

  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  const { uploading, encodeAndUploadFile } = useFileUploadManager(onFileUpload);

  return (
    <MenuItem
      autoFocus
      onClick={() => fileInputRef.current?.click()}
    >
      <StyledIconButton
        aria-label={uploading ? t("upload.uploading") : label}
        tabIndex={-1}
        disabled={disabled || uploading}
        loading={uploading}
        size="large"
      >
        {/* <AddPhotoAlternateOutlinedIcon /> */}
        {icon}
        <VisuallyHiddenInput
          type="file"
          key={fileInputKey}
          ref={fileInputRef}
          onChange={encodeAndUploadFile}
          accept={fileTypes.flatMap((def) => {
            return def.fileExtensions.map(ext => `.${ext}`);
          }).join(", ")}
        />
      </StyledIconButton>
      {label}
    </MenuItem>
  );
}

const VisuallyHiddenInput = styled("input")({
  clip: "rect(0 0 0 0)",
  clipPath: "inset(50%)",
  height: 1,
  overflow: "hidden",
  position: "absolute",
  bottom: 0,
  left: 0,
  whiteSpace: "nowrap",
  width: 1,
});
