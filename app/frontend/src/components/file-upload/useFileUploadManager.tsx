import { useMsal } from '@azure/msal-react';
import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { isValidFileType, getTokenAndUploadFile } from './fileUploadUtils';


export const useFileUploadManager = (
    onFileUpload: (file: Attachment) => void
) => {
    const [isUploading, setUploading] = useState(false);
    const { t } = useTranslation();
    const { instance } = useMsal();

    return useMemo(() => {
        const doUpload = async (file: File | undefined) => {
            // const file: File | undefined = event.target.files?.[0];

            if (file) {
                if (!isValidFileType(file)) {
                    // TODO: What to do when invalid file type?
                    // event.preventDefault();
                    const invalidFileType = t("invalid.file.type");
                    alert(invalidFileType);
                    throw Error(invalidFileType);
                }

                setUploading(true);

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

        return {
            isUploading,
            doUpload
        };
    }, [
        onFileUpload,
        setUploading,
        t
    ]);
};
