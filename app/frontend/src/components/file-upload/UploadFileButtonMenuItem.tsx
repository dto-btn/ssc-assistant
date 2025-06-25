import { AccountInfo } from "@azure/msal-browser";
import { useMsal } from "@azure/msal-react";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import { styled } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { uploadFile } from "../../api/api";
import { apiUse } from "../../authConfig";
import { MenuItem } from '@mui/material';
import { StyledIconButton } from './StyledIconButton';

interface UploadFileButtonProps {
  disabled: boolean;
  onFileUpload: (file: Attachment) => void;
}

const acceptedImageTypes = ["jpg", "jpeg", "png", "webp"];

const isValidFileType = (file: File) => {
  // only validates images for now, eventually should validate other file types
  const acceptedFileTypesFormatted = acceptedImageTypes.map(
    (type) => "image/" + type
  );
  return acceptedFileTypesFormatted.includes(file.type);
};

export function UploadFileButtonMenuItem({
  disabled,
  onFileUpload,
}: UploadFileButtonProps) {
  const { instance } = useMsal();
  const [uploading, setUploading] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(Date.now());
  const menuItemRef = useRef<HTMLLIElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { t } = useTranslation();

  const encodeAndUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("in encodeAndUploadFile");
    if (file) {
      if (!isValidFileType(file)) {
        event.preventDefault();
        const invalidFileType = t("invalid.file.type");
        alert(invalidFileType);
        throw Error(invalidFileType);
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = async () => {
        const encodedFile = reader.result as string;
        try {
          const response = await instance.acquireTokenSilent({
            ...apiUse,
            account: instance.getActiveAccount() as AccountInfo,
            forceRefresh: true,
          });

          var fileUpload = await uploadFile(
            encodedFile,
            file.name,
            response.accessToken
          );

          //TODO: Detect file type here I assume, in this case we force it to image
          fileUpload.type = "image";

          console.log("fileUpload", fileUpload);
          onFileUpload(fileUpload);
        } catch (error) {
          console.error("Error uploading file");
          throw error;
        } finally {
          setUploading(false);
          setFileInputKey(Date.now());
        }
      };
      reader.readAsDataURL(file);
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
          accept={acceptedImageTypes.map((type) => "." + type).toString()}
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
