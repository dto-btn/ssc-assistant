import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { apiUse } from "../../authConfig";
import { uploadFile } from "../../api/api";
import { validFileTypeDefinitions } from "./validFiletypeDefinitions";
import { AttachmentUtils } from "./AttachmentUtils";


export const isValidFileType = (file: File) => {
  const acceptedFileTypesFormatted = validFileTypeDefinitions.map((type) => type.fileType);
  return acceptedFileTypesFormatted.includes(file.type);
};

type UploadFileResult = 
| { success: false; error?: string; }
| { success: true; attachment: Attachment };

/**
 * This should never throw an error, it will always return a result
 * @param file 
 * @param msalInstance 
 * @param t - Translation function from useTranslation()
 * @returns 
 */
export const getTokenAndUploadFile = async (
    file: File, 
    msalInstance: IPublicClientApplication,
    t: (key: string, options?: any) => string
): Promise<UploadFileResult> => {
    try {
        // Check file size - browser memory limitations for base64 encoding
        const maxFileSize = 25 * 1024 * 1024; // 25MB in bytes
        if (file.size > maxFileSize) {
            const maxSizeMB = Math.round(maxFileSize / (1024 * 1024));
            const errorMessage = t("file.too.large", { maxSize: maxSizeMB });
            return { success: false, error: errorMessage };
        }
        
        const attachment = await new Promise<Attachment>((resolve, reject) => {
            const reader = new FileReader();
            
            // Add timeout for large files (30 seconds)
            const timeout = setTimeout(() => {
                reader.abort();
                const errorMessage = t("file.read.timeout", { seconds: 30, fileName: file.name });
                reject(new Error(errorMessage));
            }, 30000);
            
            reader.onloadend = async () => {
                clearTimeout(timeout);
                try {
                    const encodedFile: string = reader.result as string;
                    
                    // Check if the result is valid
                    if (!encodedFile || typeof encodedFile !== 'string') {
                        const errorMessage = t("file.read.failed", { fileName: file.name });
                        throw new Error(errorMessage);
                    }
                    
                    // Validate the data URL format
                    if (!encodedFile.startsWith('data:')) {
                        const errorMessage = t("file.invalid.format", { fileName: file.name });
                        throw new Error(errorMessage);
                    }
                    
                    const response = await msalInstance.acquireTokenSilent({
                        ...apiUse,
                        account: msalInstance.getActiveAccount() as AccountInfo,
                        forceRefresh: true
                    });

                    const fileUpload = await uploadFile(
                        encodedFile,
                        file.name,
                        response.accessToken
                    );

                    fileUpload.type = AttachmentUtils.getMimetypeFromEncodedFile(encodedFile, t);
                    
                    resolve(fileUpload);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                clearTimeout(timeout);
                const errorMessage = t("file.read.error", { fileName: file.name });
                reject(new Error(errorMessage));
            };
            
            reader.onabort = () => {
                clearTimeout(timeout);
                const errorMessage = t("file.read.aborted", { fileName: file.name });
                reject(new Error(errorMessage));
            };
            
            reader.readAsDataURL(file);
        });

        return {
            success: true,
            attachment
        }
    } catch (e) {
        const errorMessage = e instanceof Error ? e.message : t("error.uploading.file");
        return { success: false, error: errorMessage };
    }
}