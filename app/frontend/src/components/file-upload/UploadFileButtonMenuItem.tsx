import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useRef, useState, useCallback, ChangeEvent } from "react";
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

  const { isUploading: uploading, doUpload } = useFileUploadManager(onFileUpload);

  const handleUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      doUpload(file).catch((error) => {
        console.error("Error uploading file:", error);
        alert(t("error.uploading.file"));
      });
      // Reset the input to allow re-uploading the same file
      setFileInputKey(Date.now());
    }
  }

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
          onChange={handleUpload}
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
