import { v4 as uuidv4 } from "uuid";
import type { SuggestionContextSuccess } from "../../../api/suggestionContext.models";
import type { AppThunk } from "..";
import { addMessage } from "../slices/chatSlice";
import { addSession, setCurrentSession } from "../slices/sessionSlice";
import { requestArchive } from "../middleware/archiverMiddleware";
import { saveChatState } from "../persistence";
import { addToast } from "../slices/toastSlice";
import i18n from "../../../i18n";

const MAX_SESSION_NAME = 80;

export const importSuggestion = ({
  handoffId,
  context,
}: {
  handoffId: string;
  context: SuggestionContextSuccess;
}): AppThunk<string> => (dispatch, getState) => {
  const existing = getState().sessions.sessions.find(
    (session) => session.suggestionHandoffId === handoffId,
  );
  if (existing) {
    dispatch(setCurrentSession(existing.id));
    return existing.id;
  }

  const sessionId = uuidv4();
  const name = context.original_query.length > MAX_SESSION_NAME
    ? `${context.original_query.slice(0, MAX_SESSION_NAME - 1).replace(/[\uD800-\uDBFF]$/, "").trimEnd()}…`
    : context.original_query;
  dispatch(addSession({
    id: sessionId,
    name,
    createdAt: Date.now(),
    isNewChat: false,
    staticTools: [],
    suggestionHandoffId: handoffId,
    language: context.language,
  }));
  dispatch(addMessage({
    sessionId,
    role: "user",
    content: context.original_query,
    preserveFullContent: true,
  }));
  dispatch(addMessage({
    sessionId,
    role: "assistant",
    content: context.content,
    citations: context.citations,
    showAllCitations: true,
    preserveFullContent: true,
  }));
  dispatch(requestArchive({ sessionId }));

  // Persist the completed transcript before its navigation payload is consumed.
  if (!saveChatState(getState())) {
    dispatch(addToast({
      message: i18n.t("playground:suggestion.errors.save", {
        lng: context.language,
      }),
      severity: "error",
    }));
  }
  return sessionId;
};
