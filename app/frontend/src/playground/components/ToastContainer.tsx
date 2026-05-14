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
import { removeToast } from "../store/slices/toastSlice";

const ToastContainer: React.FC = () => {
  const toasts = useSelector((state: RootState) => state.toast.toasts);
  const dispatch = useDispatch();

  const getSeverity = (toast: { severity?: "success" | "warning" | "error"; isError?: boolean }) => {
    if (toast.severity) {
      return toast.severity;
    }

    return toast.isError ? "error" : "success";
  };

  return (
    <>
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={3000}
          onClose={() => dispatch(removeToast(toast.id))}
          anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
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