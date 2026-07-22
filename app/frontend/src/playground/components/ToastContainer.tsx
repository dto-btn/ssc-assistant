/**
 * ToastContainer component
 *
 * Small wrapper around toasts used in the playground to display transient
 * notifications such as send success, errors, or persisted state events.
 */

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { Snackbar, Alert } from "@mui/material";
import { removeToast, ToastMessage, ToastSeverity } from "../store/slices/toastSlice";

const ToastContainer: React.FC = () => {
  const toasts = useSelector((state: RootState) => state.toast.toasts);
  const dispatch = useDispatch();

  const getSeverity = (toast: Pick<ToastMessage, "severity" | "isError">): ToastSeverity => {
    if (toast.severity) {
      return toast.severity;
    }

    return toast.isError ? "error" : "success";
  };

  const getAutoHideDuration = (toast: Pick<ToastMessage, "severity" | "isError">): number | null => {
    const severity = getSeverity(toast);
    if (severity === "success") {
      return 5000;
    }

    // Keep high-signal toasts visible longer for accessibility and readability.
    // Error toasts are persistent (null) — users must dismiss them explicitly (WCAG 2.2.1).
    return severity === "error" ? null : 10000;
  };

  return (
    <>
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={getAutoHideDuration(toast)}
          onClose={() => dispatch(removeToast(toast.id))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          sx={{
            bottom: {
              xs: "calc(var(--chat-input-height, 100px) + env(safe-area-inset-bottom)) !important",
              sm: "24px !important",
            },
          }}
        >
          <Alert
            onClose={() => dispatch(removeToast(toast.id))}
            severity={getSeverity(toast)}
            sx={{ width: "100%" }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default ToastContainer;