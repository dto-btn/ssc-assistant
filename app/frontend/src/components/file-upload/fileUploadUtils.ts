import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { apiUse } from "../../authConfig";
import { uploadFile } from "../../api/api";


export const isValidFileType = (file: File) => {
  // only validates images for now, eventually should validate other file types
  const acceptedFileTypesFormatted = acceptedImageTypes.map(
    (type) => "image/" + type
  );
  return acceptedFileTypesFormatted.includes(file.type);
};

export const acceptedImageTypes = ["jpg", "jpeg", "png", "webp"];

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
                const encodedFile = reader.result as string;
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

                fileUpload.type = "image"; // Assuming we are uploading an image
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