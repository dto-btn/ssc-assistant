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
  corporateFunction?: string
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
  type?: string;
  blob_storage_url: string;
}