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
interface Attachment extends ApiAttachmentDto {
  message: string;
  file_name: string;
}

/**
 * An API model returned by the /suggest endpoint. This includes the citation text and link.
 */
interface SuggestionCitation {
  content: string;
  url: string;
}
/**
 * An API model returned by the /suggest endpoint. This includes the suggestion text and the list of citations.
 */
interface SuggestionContext {
  body: string;
  citations: SuggestionCitation[];
}

interface BusinessRequest {
  BR_NMBR: number;
  BR_TITLE: string;
  BR_SHORT_TITLE: string;
  PRIORITY_EN: string;
  PRIORITY_FR: string;
  SUB_PRIORITY: string | null;
  CLIENT_NAME_SRC: string;
  GC_ORG_NMBR: number;
  RPT_GC_ORG_NAME_EN: string;
  RPT_GC_ORG_NAME_FR: string;
  ORG_TYPE_EN: string;
  ORG_TYPE_FR: string;
  CLIENT_SUBGRP_ID: string;
  CLIENT_SUBGRP_EN: string;
  CLIENT_SUBGRP_FR: string;
  CREATE_DATE: string;
  SUBMIT_DATE: string;
  DAYS_SINCE_SUBMIT: number;
  REQST_IMPL_DATE: string;
  TARGET_IMPL_DATE: string;
  RVSD_TARGET_IMPL_DATE: string | null;
  ACTUAL_IMPL_DATE: string;
  DAYS_TO_IMPL: number;
  AGRMT_START_DATE: string;
  AGRMT_END_DATE: string;
  AGRMT_TYPE_ID: string;
  PREHLD_STATUS_ID: string | null;
  CANCEL_REASON_EN: string | null;
  CANCEL_REASON_FR: string | null;
  HOLD_REASON_EN: string | null;
  HOLD_REASON_FR: string | null;
  GROUP_ID: number;
  GROUP_EN: string;
  GROUP_FR: string;
  REGION_ACRN_EN: string;
  REGION_ACRN_FR: string;
  REGION_EN: string;
  REGION_FR: string;
  BR_DEP: string | null;
}