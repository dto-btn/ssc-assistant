import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  SuggestionHandoffSchema,
  type SuggestionErrorReason,
} from "../../api/suggestionContext.models";
import { useAppDispatch } from "../store/hooks";
import { addToast } from "../store/slices/toastSlice";
import { setCurrentSession } from "../store/slices/sessionSlice";
import { startNewSession } from "../store/thunks/sessionThunks";
import { importSuggestion } from "../store/thunks/suggestionThunks";

const errorKeys: Record<SuggestionErrorReason, string> = {
  redirect_because_context_missing: "suggestion.errors.missing",
  redirect_because_server_returned_success_false: "suggestion.errors.server",
  redirect_because_context_validation_failed: "suggestion.errors.validation",
  redirect_with_unknown_error: "suggestion.errors.unknown",
};

const NewConversationOnOpen = () => {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation("playground");
  const processedKeys = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    if (processedKeys.current.has(location.key)) return;
    processedKeys.current.add(location.key);

    const stateResult = z.record(z.unknown()).safeParse(location.state);
    const state = stateResult.success ? stateResult.data : {};

    const changeLanguage = (language: "en" | "fr") => {
      void i18n.changeLanguage(language).catch((error: unknown) => {
        console.error("Could not set suggestion language", error);
        dispatch(addToast({
          message: t("suggestion.errors.unknown"),
          severity: "error",
        }));
      });
    };

    if (!Object.hasOwn(state, "suggestionHandoff")) {
      if (!initialized.current) {
        initialized.current = true;
        const restoredLanguage = dispatch((innerDispatch, getState) => {
          const session = getState().sessions.sessions.find(
            (entry) => entry.id === state.suggestionSessionId,
          );
          if (session) {
            innerDispatch(setCurrentSession(session.id));
            return session.language;
          }
          innerDispatch(startNewSession());
          return undefined;
        });
        if (restoredLanguage) changeLanguage(restoredLanguage);
      }
      return;
    }

    initialized.current = true;
    const parsed = SuggestionHandoffSchema.safeParse(state.suggestionHandoff);
    const remainingState = { ...state };
    delete remainingState.suggestionHandoff;
    delete remainingState.suggestionSessionId;

    if (parsed.success && parsed.data.success) {
      const { handoffId, context } = parsed.data;
      changeLanguage(context.language);
      remainingState.suggestionSessionId = dispatch(
        importSuggestion({ handoffId, context }),
      );
    } else {
      if (!parsed.success) {
        console.error("Suggestion hand-off failed validation", parsed.error.issues);
      }
      const errorKey = parsed.success && !parsed.data.success
        ? errorKeys[parsed.data.errorReason]
        : "suggestion.errors.validation";
      dispatch(addToast({ message: t(errorKey), severity: "error" }));
      dispatch((innerDispatch, getState) => {
        if (!getState().sessions.currentSessionId) {
          innerDispatch(startNewSession());
        }
      });
    }

    navigate(
      { pathname: location.pathname, search: location.search, hash: location.hash },
      {
        replace: true,
        state: Object.keys(remainingState).length ? remainingState : null,
      },
    );
  }, [dispatch, location, navigate, t, i18n]);

  return null;
};

export default NewConversationOnOpen;
