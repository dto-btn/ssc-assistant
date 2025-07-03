import { validFileTypeDefinitions } from "./validFiletypeDefinitions";

validFileTypeDefinitions

export class AttachmentUtils {
    static getImageTypeDefs(): ValidFileTypeDefinition[] {
        return validFileTypeDefinitions
            .filter(def => def.category === "image")
    }

    static getDocumentTypeDefs(): ValidFileTypeDefinition[] {
        return validFileTypeDefinitions
            .filter(def => def.category === "document")
    }

    static getMimetypeFromEncodedFile(encodedFile: string): string {
        // validate with regex to ensure it starts with "data:" and contains a valid MIME type
        const dataUrlPattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-+.]+);base64,/;
        if (!dataUrlPattern.test(encodedFile)) {
            const msg = "Invalid encoded file format. Expected a data URL starting with 'data:' followed by a valid MIME type.";
            console.error(msg);
            throw new Error(msg);
        }

        const mimeType = encodedFile.split(';')[0].split(':')[1];
        const fileTypeDefinition = validFileTypeDefinitions.find(def => def.fileType === mimeType);

        if (!fileTypeDefinition) {
            const msg = `Unsupported file type: ${mimeType}`;
            console.error(msg);
            throw new Error(msg);
        }
        
        if (fileTypeDefinition?.category === "image") {
            // all images are treated as "image" type
            return "image";
        }

        // for everything else, use the specific file type
        return fileTypeDefinition.fileType;
    }

    static isDocumentType(fileType: string | undefined): boolean {
        if (!fileType) {
            return false;
        }

        if (fileType === "document") {
            return true;
        }

        const matchesValidTypeDefs = validFileTypeDefinitions.some(def => def.fileType === fileType && def.category === "document");
        if (matchesValidTypeDefs) {
            return true;
        }

        return false;
    }
}