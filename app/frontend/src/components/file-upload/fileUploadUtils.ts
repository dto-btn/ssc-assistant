import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { apiUse } from "../../authConfig";
import { uploadFile } from "../../api/api";
import { validFileTypeDefinitions } from "./validFiletypeDefinitions";


export const isValidFileType = (file: File) => {
  const acceptedFileTypesFormatted = validFileTypeDefinitions.map((type) => type.fileType);
  return acceptedFileTypesFormatted.includes(file.type);
};

type UploadFileResult = 
| { success: false; }
| { success: true; attachment: Attachment };

/**
 * This should never throw an error, it will always return a result
 * @param file 
 * @param msalInstance 
 * @returns 
 */
export const getTokenAndUploadFile = async (file: File, msalInstance: IPublicClientApplication): Promise<UploadFileResult> => {
    try {
        const attachment = await new Promise<Attachment>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const encodedFile: string = reader.result as string;
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

                // get filetype from encodedFile
                const mimeType = encodedFile.split(';')[0].split(':')[1];
                const fileTypeDefinition = validFileTypeDefinitions.find(def => def.fileType === mimeType);
                fileUpload.type = fileTypeDefinition?.category || "document";
                console.log("fileUpload", fileUpload);
                resolve(fileUpload);
            }
            reader.readAsDataURL(file);
        });

        return {
            success: true,
            attachment
        }
    } catch (e) {
        console.error("Error uploading file", e);
        return { success: false };
    }
}