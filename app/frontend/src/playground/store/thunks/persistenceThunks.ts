import i18n from "../../../i18n";
import type { AppThunk } from "..";
import { saveChatState, type ChatSaveResult } from "../persistence";
import { addToast } from "../slices/toastSlice";

let lastResult: ChatSaveResult = "saved";

export const persistPlaygroundState = (suggestionLanguage?: "en" | "fr"): AppThunk =>
  (dispatch, getState) => {
    const result = saveChatState(getState());
    const shouldNotify = result !== "saved" && result !== lastResult;
    lastResult = result;
    if (!shouldNotify) return;

    const message = result === "shortened"
      ? "playground:persistence.shortened"
      : suggestionLanguage
        ? "playground:suggestion.errors.save"
        : "playground:persistence.failed";
    dispatch(addToast({
      message: i18n.t(message, { lng: suggestionLanguage }),
      severity: result === "shortened" ? "warning" : "error",
    }));
  };
