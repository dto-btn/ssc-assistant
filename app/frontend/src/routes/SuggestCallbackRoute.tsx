import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { v4 as uuidv4 } from "uuid";
import { getSuggestionContext } from "../api/suggestionContext.api";
import {
  SuggestionContextSchema,
  type ParsedSuggestionContext,
} from "../api/suggestionContext.models";

export const SuggestCallbackRoute = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const suggestionContextId = searchParams.get("suggestionContextId");

  useEffect(() => {
    let active = true;
    const handoffId = uuidv4();

    const redirect = (handoff: ParsedSuggestionContext) => {
      if (!active) {
        return;
      }

      // The callback also works before the playground becomes the home route.
      const destination = import.meta.env.VITE_PLAYGROUND_ON === "true"
        ? "/playground"
        : "/";
      navigate(destination, {
        replace: true,
        state: {
          suggestionHandoff: handoff,
        },
      });
    };

    const loadSuggestion = async () => {
      if (!suggestionContextId?.trim()) {
        redirect({
          handoffId,
          success: false,
          errorReason: "redirect_because_context_missing",
        });
        return;
      }

      try {
        const response = await getSuggestionContext({
          suggestionContextId,
        });

        if (!active) {
          return;
        }

        const parsed = SuggestionContextSchema.safeParse(response);

        if (!parsed.success) {
          console.error("Suggestion response failed validation", {
            issues: parsed.error.issues,
          });

          redirect({
            handoffId,
            success: false,
            errorReason: "redirect_because_context_validation_failed",
          });
          return;
        }

        if (!parsed.data.success) {
          console.error("Suggestion API returned success: false");

          redirect({
            handoffId,
            success: false,
            errorReason: "redirect_because_server_returned_success_false",
          });
          return;
        }

        redirect({
          handoffId,
          success: true,
          context: parsed.data,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        console.error("Unable to load suggestion context", error);

        redirect({
          handoffId,
          success: false,
          errorReason: "redirect_with_unknown_error",
        });
      }
    };

    void loadSuggestion();

    return () => {
      active = false;
    };
  }, [suggestionContextId, navigate]);

  return null;
};