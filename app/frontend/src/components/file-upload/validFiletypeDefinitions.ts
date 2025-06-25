type ValidFileTypeDefinition = {
    fileType: string; // e.g., "image/jpeg"
    fileExtensions: string[]; // e.g., ["jpg"]
    description: string; // e.g., "JPEG image"
}

export const validFileTypeDefinitions: ValidFileTypeDefinition[] = [
    {
        fileType: "image/jpeg",
        fileExtensions: ["jpg", "jpeg"],
        description: "JPEG image"
    },
    {
        fileType: "image/png",
        fileExtensions: ["png"],
        description: "PNG image"
    },
    {
        fileType: "image/webp",
        fileExtensions: ["webp"],
        description: "WebP image"
    }
];