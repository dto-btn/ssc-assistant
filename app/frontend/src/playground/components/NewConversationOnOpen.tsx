/**
 * NewConversationOnOpen component
 *
 * Ensures the Playground always starts on a fresh, empty conversation every
 * time the app is opened. Previous sessions remain accessible in the sidebar.
 *
 * Runs once on mount. If an empty draft session already exists it will be
 * reused rather than creating a duplicate.
 */

import React from "react";
import { useAppDispatch } from "../store/hooks";
import { startNewSession } from "../store/thunks/sessionThunks";

const NewConversationOnOpen: React.FC = () => {
  const dispatch = useAppDispatch();
  const hasRunRef = React.useRef(false);

  React.useEffect(() => {
    if (hasRunRef.current) {
      return;
    }
    hasRunRef.current = true;
    dispatch(startNewSession());
  }, [dispatch]);

  return null;
};

export default NewConversationOnOpen;
