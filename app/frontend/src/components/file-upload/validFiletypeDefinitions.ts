export type ValidFileTypeDefinition = {
    fileType: string; // e.g., "image/jpeg"
    fileExtensions: string[]; // e.g., ["jpg"]
    description: string; // e.g., "JPEG image"
    category: "image" | "document"; // this is used for different button definitions
}

export const validFileTypeDefinitions: ValidFileTypeDefinition[] = [
    // images
    {
        fileType: "image/jpeg",
        fileExtensions: ["jpg", "jpeg"],
        description: "JPEG image",
        category: "image"
    },
    {
        fileType: "image/png",
        fileExtensions: ["png"],
        description: "PNG image",
        category: "image"
    },
    {
        fileType: "image/webp",
        fileExtensions: ["webp"],
        description: "WebP image",
        category: "image"
    },
    // documents
    {
        fileType: "application/pdf",
        fileExtensions: ["pdf"],
        description: "PDF document",
        category: "document"
    },
    {
        fileType: "application/msword",
        fileExtensions: ["doc", "docx"],
        description: "Microsoft Word document",
        category: "document"
    },
    {
        fileType: "application/vnd.ms-excel",
        fileExtensions: ["xls", "xlsx"],
        description: "Microsoft Excel spreadsheet",
        category: "document"
    }
];