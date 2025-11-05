/**
 * SessionBootstrapper component
 *
 * Attempts to discover archived sessions in blob storage once an access
 * token is available so the playground can restore chat history even when
 * the local state has been cleared.
 */

import React from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { bootstrapSessionsFromStorage } from "../store/thunks/sessionBootstrapThunks";

// Toggle to enable or disable remote session bootstrapping. this will added only till the delete code is inplace
const ENABLE_REMOTE_SESSION_BOOTSTRAP = true;

const SessionBootstrapper: React.FC = () => {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const hasBootstrappedRef = React.useRef(false);

  React.useEffect(() => {
    if (!ENABLE_REMOTE_SESSION_BOOTSTRAP) {
      return;
    }
    if (!accessToken || hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;
    void dispatch(bootstrapSessionsFromStorage());
  }, [accessToken, dispatch]);

  return null;
};

export default SessionBootstrapper;
