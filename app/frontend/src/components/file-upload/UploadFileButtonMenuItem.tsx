import { useMsal } from "@azure/msal-react";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { MenuItem } from '@mui/material';
import { StyledIconButton } from './StyledIconButton';
import { getTokenAndUploadFile, isValidFileType } from './fileUploadUtils';
import { validFileTypeDefinitions } from './validFiletypeDefinitions';

interface UploadFileButtonProps {
  disabled: boolean;
  onFileUpload: (file: Attachment) => void;
}

export function UploadFileButtonMenuItem({
  disabled,
  onFileUpload,
}: UploadFileButtonProps) {
  const { instance } = useMsal();
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  const encodeAndUploadFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file: File | undefined = event.target.files?.[0];

    if (file) {
      if (!isValidFileType(file)) {
        event.preventDefault();
        const invalidFileType = t("invalid.file.type");
        alert(invalidFileType);
        throw Error(invalidFileType);
      }

      setUploading(true);
      debugger;
      const attachment = await getTokenAndUploadFile(file, instance);
      switch (attachment.success) {
        case true:
          onFileUpload(attachment.attachment);
          break;
        case false:
          const errorMessage = t("error.uploading.file");
          console.error(errorMessage);
          alert(errorMessage);
          break;
      }

      setUploading(false);
    }
  };

  return (
    <MenuItem
      autoFocus
      onClick={() => fileInputRef.current?.click()}
    >
      <StyledIconButton
        aria-label={uploading ? t("upload.uploading") : t("upload.image")}
        tabIndex={-1}
        disabled={disabled || uploading}
        loading={uploading}
        size="large"
      >
        <AddPhotoAlternateOutlinedIcon />
        <VisuallyHiddenInput
          type="file"
          key={fileInputKey}
          ref={fileInputRef}
          onChange={encodeAndUploadFile}
          accept={validFileTypeDefinitions.flatMap((def) => {
            return def.fileExtensions.map(ext => `.${ext}`);
          }).join(", ")}
        />
      </StyledIconButton>
      {t("attach.image")}
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
