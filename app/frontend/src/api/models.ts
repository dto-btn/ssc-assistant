interface Metadata {
  chunking: string;
}

interface Citation {
  content: string;
  url: string;
  metadata: Metadata;
  title: string;
  chunk_id?: string | null;
  id?: any | null;
  filepath?: any | null;
}

interface Context {
  role: string;
  citations: Citation[];
  intent: string[];
}

interface Message {
  role: string;
  content?: string | null;
  context?: Context | null;
  tools_info?: ToolInfo;
  quotedText?: string;
  attachments?: Attachment[];
}

interface Completion {
  message: Message;
  completion_tokens?: number | null;
  prompt_tokens?: number | null;
  total_tokens?: number | null;
}

interface MessageRequest {
  query?: string | null;
  messages?: Message[] | null;
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

interface ToastMessage {
  toastMessage: string;
  isError: boolean;
}

type ChatItem = Message | Completion | ToastMessage;

interface ToolInfo {
  tool_type: string[];
  function_names: string[];
  payload?: Record<string, any>;
}

interface EmployeeProfile {
  email: string;
  name: string;
  phone?: string;
  url: string;
  organization_en: string;
  organization_fr: string;
  matchedProfile?: boolean;
}

interface ChatHistory {
  chatItems: ChatItem[];
  description: string;
  uuid: string;
  model: string;
}

interface BookingConfirmation {
  bookingType: string;
  buildingId: string;
  floorId: string;
  roomId: string;
  createdBy: string;
  assignedTo: string;
  startDate: string;
}
interface Attachment {
  type: string;
  blob_storage_url: string;
  encoded_file: string;
}