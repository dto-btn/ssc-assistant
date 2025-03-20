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
  CLIENT_NAME_SRC: string;
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
  RVSD_TARGET_IMPL_DATE: string;
  ACTUAL_IMPL_DATE: string;
  DAYS_TO_IMPL: number;
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
  BR_TYPE_EN: string;
  BR_TYPE_FR: string;
  FUNDING_TYPE_EN: string;
  FUNDING_TYPE_FR: string;
  CPLX_EN: string;
  CPLX_FR: string;
  SCOPE_EN: string;
  SCOPE_FR: string;
  BR_OWNER: string;
  BR_INITR: string;
  BR_LAST_EDITOR: string;
  CSM_OPI: string;
  TL_OPI: string;
  CSM_DIRTR: string;
  SOL_OPI: string;
  ENGN_OPI: string;
  BA_OPI: string;
  BA_TL: string;
  PM_OPI: string;
  BA_PRICE_OPI: string;
  QA_OPI: string;
  SL_COORD: string;
  AGRMT_OPI: string;
  ACCT_MGR_OPI: string;
  SDM_TL_OPI: string;
  REQMT_OVRVW: string;
  ASSOC_BRS: string;
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
