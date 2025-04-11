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
  tools_info?: ToolInfo[];
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
  tool_type: string;
  function_name: string;
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
  LEAD_PRODUCT_EN: string;
  LEAD_PRODUCT_FR: string;
  BR_NMBR: number;
  BR_SHORT_TITLE: string;
  RPT_GC_ORG_NAME_EN: string;
  RPT_GC_ORG_NAME_FR: string;
  ORG_TYPE_EN: string;
  ORG_TYPE_FR: string;
  REQST_IMPL_DATE: string;
  BR_TYPE_EN: string;
  BR_TYPE_FR: string;
  PRIORITY_EN: string;
  PRIORITY_FR: string;
  SUBMIT_DATE: string;
  RVSD_TARGET_IMPL_DATE: string;
  CPLX_EN: string;
  CPLX_FR: string;
  ACTUAL_IMPL_DATE: string;
  AGRMT_END_DATE: string;
  SCOPE_EN: string;
  SCOPE_FR: string;
  CLIENT_REQST_SOL_DATE: string;
  CLIENT_SUBGRP_EN: string;
  CLIENT_SUBGRP_FR: string;
  PRPO_TARGET_DATE: string;
  IMPL_SGNOFF_DATE: string;
  GROUP_EN: string;
  GROUP_FR: string;
  BR_ACTIVE_EN: string;
  BR_ACTIVE_FR: string;
  BITS_STATUS_EN: string;
  BITS_STATUS_FR: string;
  ASSOC_BRS: string;
  ACC_MANAGER_OPI: string;
  AGR_OPI: string;
  BA_OPI: string;
  BA_PRICING_OPI: string;
  BA_PRICING_TL: string;
  BA_TL: string;
  CSM_DIRECTOR: string;
  EAOPI: string;
  PM_OPI: string;
  QA_OPI: string;
  SDM_TL_OPI: string;
  BR_OWNER: string;
  TEAMLEADER: string;
  WIO_OPI: string;
  GCIT_CAT_EN: string;
  GCIT_CAT_FR: string;
  GCIT_PRIORITY_EN: string;
  GCIT_PRIORITY_FR: string;
  TARGET_IMPL_DATE: string;
  IO_ID: string;
  EPS_NMBR: string;
  ECD_NMBR: string;
  PROD_OPI: string;
}

interface BusinessRequestUpdate {
  BR_NMBR: number;
  PERIOD_END_DATE: string;
  DAYS_SINCE_SUBMIT: string;
  LAST_STATUS_DATE: string;
  DAYS_IN_STATUS: string;
  AGE_IN_STATUS_EN: string;
  AGE_IN_STATUS_FR: string;
  IMPL_FLAG_EN: string;
  IMPL_FLAG_FR: string;
  BITS_STATUS_EN: string;
  BITS_STATUS_FR: string;
  BR_ACTIVE_EN: string;
  BR_ACTIVE_FR: string;
}
