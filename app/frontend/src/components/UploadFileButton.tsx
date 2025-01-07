import { styled } from "@mui/material/styles";
import IconButton from "@mui/material/Button";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import { uploadFile } from "../api/api";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../authConfig";
import { AccountInfo } from "@azure/msal-browser";

interface UploadFileButtonProps {
  disabled: boolean;
  onFileUpload: (file: FileUpload) => void;
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

export default function InputFileUpload({
  disabled,
  onFileUpload,
}: UploadFileButtonProps) {
  const { instance } = useMsal();

  const encodeAndUploadFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    console.log("in encodeAndUploadFile");
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const encodedFile = reader.result as string;
        try {
          const response = await instance.acquireTokenSilent({
            ...apiUse,
            account: instance.getActiveAccount() as AccountInfo,
            forceRefresh: true,
          });
          console.log(
            "Processing encoded file: ",
            encodedFile.substring(0, 100)
          );
          var fileUpload = await uploadFile(
            encodedFile,
            file.name,
            response.accessToken
          );
          onFileUpload(fileUpload);
        } catch (error) {
          console.error("Error uploading file");
          throw error;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <IconButton
      component="label"
      role={undefined}
      variant="text"
      tabIndex={-1}
      disabled={disabled}
    >
      <AttachFileIcon />
      <VisuallyHiddenInput
        type="file"
        onChange={encodeAndUploadFile}
        //accept=".jpg,.jpeg,.png" //only images for now since the UI doesn't support other file types
        accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
        //multiple
      />
    </IconButton>
  );
}
