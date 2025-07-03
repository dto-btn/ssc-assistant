export type ValidFileTypeDefinition = {
    fileType: string; // e.g., "image/jpeg"
    fileExtensions: string[]; // e.g., ["jpg"]
    description: string; // e.g., "JPEG image"
    category: "image" | "document"; // this is used for different button definitions
}

export const validFileTypeDefinitions: ValidFileTypeDefinition[] = [
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
    },
    {
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        fileExtensions: ["docx"],
        description: "OpenXML Word document",
        category: "document"
    },
    {
        fileType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        fileExtensions: ["xlsx"],
        description: "OpenXML Excel spreadsheet",
        category: "document"
    },
    {
        fileType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        fileExtensions: ["pptx"],
        description: "OpenXML PowerPoint presentation",
        category: "document"
    },
    {
        fileType: "application/vnd.ms-powerpoint",
        fileExtensions: ["ppt"],
        description: "Microsoft PowerPoint presentation",
        category: "document"
    },
    {
        fileType: "text/plain",
        fileExtensions: ["txt"],
        description: "Text file",
        category: "document"
    },
    {
        fileType: "text/csv",
        fileExtensions: ["csv"],
        description: "CSV file",
        category: "document"
    }
];