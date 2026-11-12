import { v4 as uuidv4 } from "uuid";
import type { SuggestionContextSuccess } from "../../../api/suggestionContext.models";
import type { AppThunk } from "..";
import { addMessage } from "../slices/chatSlice";
import { addSession, setCurrentSession } from "../slices/sessionSlice";
import { requestArchive } from "../middleware/archiverMiddleware";
import { saveChatState } from "../persistence";
import { addToast } from "../slices/toastSlice";
import i18n from "../../../i18n";

export const importSuggestion =
  ({
    handoffId,
    context,
  }: {
    handoffId: string;
    context: SuggestionContextSuccess;
  }): AppThunk<string> =>
  (dispatch, getState) => {
    const existing = getState().sessions.sessions.find(
      (session) => session.suggestionHandoffId === handoffId,
    );
    if (existing) {
      dispatch(setCurrentSession(existing.id));
      return existing.id;
    }

    const sessionId = uuidv4();
    dispatch(
      addSession({
        id: sessionId,
        name: context.original_query,
        createdAt: Date.now(),
        isNewChat: false,
        staticTools: [],
        suggestionHandoffId: handoffId,
        language: context.language,
      }),
    );
    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content: context.original_query,
      }),
    );
    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: context.content,
        citations: context.citations,
        showAllCitations: true,
      }),
    );
    dispatch(requestArchive({ sessionId }));

    // Persist the completed transcript before its navigation payload is consumed.
    if (!saveChatState(getState())) {
      dispatch(
        addToast({
          message: i18n.t("playground:suggestion.errors.save", {
            lng: context.language,
          }),
          severity: "error",
        }),
      );
    }
    return sessionId;
  };
