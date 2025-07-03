interface ApiMessageRequestDto {
  query?: string | null;
  messages?: ApiMessageDto[] | null;
  top?: number;
  lang?: string;
  max?: number;
  tools?: string[];
  uuid?: string;
  quotedText?: string;
  model: string;
  fullName?: string;
}

interface ApiMessageDto {
  role: string;
  content?: string | null;
  context?: Context | null;
  tools_info?: ToolInfo[];
  quotedText?: string;
  attachments?: ApiAttachmentDto[];
}

interface ApiAttachmentDto {
  // type is the mimetype, keys into validFileTypeDefinitions.fileType
  // for backwards compatibility, we also support "image" and "document"
  type?: string;
  blob_storage_url: string;
}


interface ValidFileTypeDefinition {
    fileType: string; // e.g., "image/jpeg"
    fileExtensions: string[]; // e.g., ["jpg"]
    description: string; // e.g., "JPEG image"
    category: "image" | "document"; // this is used for different button definitions
}
