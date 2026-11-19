import { v4 as uuidv4 } from "uuid";
import type { SuggestionContextSuccess } from "../../../api/suggestionContext.models";
import type { AppThunk } from "..";
import { addMessage } from "../slices/chatSlice";
import { addSession, setCurrentSession } from "../slices/sessionSlice";
import { requestArchive } from "../middleware/archiverMiddleware";
import { persistPlaygroundState } from "./persistenceThunks";

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
  dispatch(addSession({
    id: sessionId,
    name: context.original_query,
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
  dispatch(persistPlaygroundState(context.language));
  return sessionId;
};
