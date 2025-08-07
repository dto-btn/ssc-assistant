import { useMsal } from "@azure/msal-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isValidFileType, getTokenAndUploadFile } from "./fileUploadUtils";

export const useFileUploadManager = (
  onFileUpload: (file: Attachment) => void,
  onError?: (error: ToastMessage) => void
) => {
  const [isUploading, setUploading] = useState(false);
  const { t } = useTranslation();
  const { instance } = useMsal();

  return useMemo(() => {
    const doUpload = async (file: File | undefined) => {
      // const file: File | undefined = event.target.files?.[0];

      if (file) {
        try {
          if (!isValidFileType(file)) {
            const invalidFileType = t("invalid.file.type");
            throw Error(invalidFileType);
          }

          setUploading(true);

          const attachment = await getTokenAndUploadFile(file, instance, t);
          if (attachment.success) {
            onFileUpload(attachment.attachment);
          } else {
            const errorMessage = attachment.error || t("error.uploading.file");
            if (onError) {
              onError({
                toastMessage: errorMessage,
                isError: true,
              });
            }
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : t("error.uploading.file");
          if (onError) {
            onError({
              toastMessage: errorMessage,
              isError: true,
            });
          }
        } finally {
          setUploading(false);
        }
      }
    };

    return {
      isUploading,
      doUpload,
    };
  }, [onFileUpload, setUploading, t]);
};
