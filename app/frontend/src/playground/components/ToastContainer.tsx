import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { Snackbar, Alert } from "@mui/material";
import { removeToast } from "../store/slices/toastSlice";

const ToastContainer: React.FC = () => {
  const toasts = useSelector((state: RootState) => state.toast.toasts);
  const dispatch = useDispatch();

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
            severity={toast.isError ? "error" : "success"}
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