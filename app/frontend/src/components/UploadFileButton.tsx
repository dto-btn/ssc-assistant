import { styled } from "@mui/material/styles";
import IconButton from "@mui/material/Button";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { uploadFile } from "../api/api";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../authConfig";
import { AccountInfo } from "@azure/msal-browser";
import { useState } from "react";
import { CircularProgress } from "@mui/material";
import { t } from "i18next";
import { FileUpload } from "../models/files";

interface UploadFileButtonProps {
  disabled: boolean;
  onFileUpload: (file: FileUpload) => void;
}

const acceptedImageTypes = ["jpg", "jpeg", "png", "webp"];

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

const isValidFileType = (file: File) => {
  // only validates images for now, eventually should validate other file types
  const acceptedFileTypesFormatted = acceptedImageTypes.map(type => 'image/' + type);
  return acceptedFileTypesFormatted.includes(file.type);
};

export default function InputFileUpload({
  disabled,
  onFileUpload,
}: UploadFileButtonProps) {
  const { instance } = useMsal();
  const [uploading, setUploading] = useState(false);

  const encodeAndUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("in encodeAndUploadFile");
    if (file) {
      if (!isValidFileType(file)) {
        event.target.value = ""; // Clear the input
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
        }
      };
      reader.readAsDataURL(file);
    }
    event.target.value = "";
  };

  return (
    <IconButton
      component="label"
      role={undefined}
      variant="text"
      tabIndex={-1}
      disabled={disabled || uploading}
    >
      {uploading ? <CircularProgress /> : <AttachFileIcon />}
      <VisuallyHiddenInput
        type="file"
        onChange={encodeAndUploadFile}
        accept={acceptedImageTypes.map(type => '.' + type).toString()} //only images for now since OpenAI API only supports images
      // https://platform.openai.com/docs/guides/vision#what-type-of-files-can-i-upload (TLDR; png, jpeg, jpg, webp.)
      // (and non animated gif but we will omit them for simplicity for now)
      //accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
      //multiple
      />
    </IconButton>
  );
}
