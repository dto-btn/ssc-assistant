/**
 * ChatArea component
 *
 * Renders the main chat area for the playground including messages and
 * metadata such as citations and feedback controls. Exports a React
 * component used by `PlaygroundRoot`/`Playground`.
 */

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store"; // Ensure AppDispatch is exported from your store
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ReplayStopBar from "./ReplayStopBar";
import Citations from "./Citations";
import type { Citation } from "./Citations";
import { Box, Typography } from "@mui/material";
import { addMessage, setIsLoading } from "../store/slices/chatSlice";
import Suggestions from "./Suggestions";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import { useTranslation } from 'react-i18next';
import { listSessionFiles } from "../api/storage";
import { setSessionFiles } from "../store/slices/sessionFilesSlice";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import type { FileAttachment } from "../types";
import { downloadTranscriptPdf } from "../services/pdfExportService";
import { addToast } from "../store/slices/toastSlice";
import { rehydrateSessionFromArchive } from "../store/thunks/sessionBootstrapThunks";
import { pickLatestArchive } from "../utils/archives";
import { applyRemoteSessionDeletion } from "../store/thunks/sessionManagementThunks";

const ChatArea: React.FC = () => {
  const { t } = useTranslation('playground');
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector(
    (state: RootState) => state.sessions.currentSessionId
  );
  const sessions = useSelector((state: RootState) => state.sessions.sessions);
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const syncEntries = useSelector((state: RootState) => state.sync.byId);
  const rehydratedSessionsRef = React.useRef<Set<string>>(new Set());
  const rehydratingSessionsRef = React.useRef<Set<string>>(new Set());
  const [isExporting, setIsExporting] = React.useState(false);
  const hydratedArchiveVersionRef = React.useRef<Map<string, string | null>>(new Map());
  const fetchedSessionsRef = React.useRef<Set<string>>(new Set());

  // Use memoized selector for messages
  const messages = useSelector(selectMessagesBySessionId);
  const sessionFiles = useSelector(selectCurrentSessionFiles);
  const latestRemoteArchive = React.useMemo(
    () => pickLatestArchive(sessionFiles),
    [sessionFiles]
  );

  // Create a single reversed view to avoid repeated copying/reversal
  const reversedMessages = React.useMemo(
    () => [...messages].reverse(),
    [messages]
  );

  // Find citations from the last assistant message
  const lastAssistantMessage = reversedMessages.find(
    (message) => message.role === "assistant"
  );
  const citations = lastAssistantMessage?.citations ?? [];

  /**
   * Replay sends the most recent user utterance so the assistant can retry with new context.
   */
  const handleReplay = (): void => {
    if (messages.length < 2) return;
    // Index of the last user message in the reversed array
    const lastUserMessageIndexFromEnd = reversedMessages.findIndex(
      (message) => message.role === "user"
    );
    if (lastUserMessageIndexFromEnd === -1) return;
    const userMessage =
      messages[messages.length - 2 - lastUserMessageIndexFromEnd];
    if (userMessage) {
      dispatch(
        addMessage({
          sessionId: currentSessionId!,
          role: "user",
          content: userMessage.content,
          attachments: userMessage.attachments,
        })
      );
    }
  };

  /**
   * Stop flips the loading flag which signals the UI to hide the typing indicator.
   */
  const handleStop = (): void => {
    dispatch(setIsLoading(false));
  };

  const handleDownloadTranscript = React.useCallback(async (): Promise<void> => {
    if (!currentSessionId) return;
    if (messages.length === 0) {
      dispatch(addToast({ message: t("pdf.toast.empty"), isError: true }));
      return;
    }

    const session = sessions.find((entry) => entry.id === currentSessionId);
    if (!session) return;

    setIsExporting(true);
    try {
      await downloadTranscriptPdf({
        session,
        messages,
        locale: navigator.language,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        translator: t,
      });
      dispatch(addToast({ message: t("pdf.toast.success") }));
    } catch (error) {
      console.error("Failed to download transcript", error);
      dispatch(addToast({ message: t("pdf.toast.error"), isError: true }));
    } finally {
      setIsExporting(false);
    }
  }, [currentSessionId, dispatch, messages, sessions, t]);

  // Suggestions logic
  /**
   * Convert a canned suggestion into a user turn for quick-start prompts.
   */
  const handleSuggestion = (suggestion: string): void => {
    dispatch(
      addMessage({
        sessionId: currentSessionId!,
        role: "user",
        content: suggestion,
      })
    );
  };

  // Load persisted attachments each time a session becomes active so we can
  // detect remote updates and keep local state fresh.
  React.useEffect(() => {
    if (!currentSessionId || !accessToken) return undefined;

    let cancelled = false;
    (async () => {
      try {
        console.debug("Loading session files", { sessionId: currentSessionId });
        const result = await listSessionFiles({ sessionId: currentSessionId, accessToken });
        if (cancelled) return;
        if (result.deletedSessionIds.length) {
          result.deletedSessionIds
            .filter((id) => id && id !== currentSessionId)
            .forEach((id) => {
              void dispatch(applyRemoteSessionDeletion(id, { silent: true }));
            });
        }
        if (result.sessionDeleted) {
          rehydratedSessionsRef.current.delete(currentSessionId);
          rehydratingSessionsRef.current.delete(currentSessionId);
          hydratedArchiveVersionRef.current.delete(currentSessionId);
          fetchedSessionsRef.current.delete(currentSessionId);
          void dispatch(applyRemoteSessionDeletion(currentSessionId));
          return;
        }
        const files = result.files;
        dispatch(setSessionFiles({ sessionId: currentSessionId, files }));
        const latestArchive = pickLatestArchive(files);
        const latestVersion: string | null = latestArchive?.lastUpdated ?? latestArchive?.uploadedAt ?? null;
        fetchedSessionsRef.current.add(currentSessionId);
        const hydratedVersion = hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
        if (hydratedVersion !== latestVersion) {
          rehydratedSessionsRef.current.delete(currentSessionId);
        }
        console.debug("Loaded session files", {
          sessionId: currentSessionId,
          fileCount: files.length,
          latestVersion,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load session files", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, accessToken, dispatch]);

  const currentSyncStatus = currentSessionId ? syncEntries[currentSessionId]?.status : undefined;

  // Automatically rehydrate archived chats when a session is opened or when the
  // remote archive version changes.
  React.useEffect(() => {
    if (!currentSessionId) return undefined;
    if (rehydratingSessionsRef.current.has(currentSessionId)) return undefined;

    const remoteVersion = fetchedSessionsRef.current.has(currentSessionId)
      ? (latestRemoteArchive?.lastUpdated ?? latestRemoteArchive?.uploadedAt ?? null)
      : undefined;
    const hydratedVersion = hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
    const hasMessages = messages.length > 0;
    const hasPendingLocal = currentSyncStatus === "pending" || currentSyncStatus === "syncing" || currentSyncStatus === "error";
    if (hasPendingLocal) return undefined;

    const remoteVersionKnown = remoteVersion !== undefined;
    const remoteChanged = remoteVersionKnown && remoteVersion !== hydratedVersion;
    const needsInitialHydration = !hasMessages && !rehydratedSessionsRef.current.has(currentSessionId);

    if (!needsInitialHydration && !remoteChanged) {
      return undefined;
    }

    if (!remoteVersionKnown && !needsInitialHydration) {
      return undefined;
    }

    rehydratingSessionsRef.current.add(currentSessionId);
    let cancelled = false;

    (async () => {
      try {
        const result = await dispatch(
          rehydrateSessionFromArchive(currentSessionId, { force: remoteChanged })
        );
        if (cancelled) return;

        const latestVersion =
          result?.latestVersion !== undefined
            ? result.latestVersion
            : (remoteVersion ?? null);

        fetchedSessionsRef.current.add(currentSessionId);

        if (result?.restored) {
          hydratedArchiveVersionRef.current.set(currentSessionId, latestVersion);
          rehydratedSessionsRef.current.add(currentSessionId);
        } else if (!(result?.hasArchive ?? false)) {
          hydratedArchiveVersionRef.current.set(currentSessionId, null);
          rehydratedSessionsRef.current.add(currentSessionId);
        } else if (latestVersion === hydratedVersion) {
          rehydratedSessionsRef.current.add(currentSessionId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to restore chat archive", error);
        }
      } finally {
        rehydratingSessionsRef.current.delete(currentSessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, currentSyncStatus, dispatch, messages.length, latestRemoteArchive]);

  if (!currentSessionId) {
    return (
      <Box flex={1} display="flex" alignItems="center" justifyContent="center">
        {t("select.or.create.session")}
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={6}
      >
        <Typography variant="h3" gutterBottom>
          {t("how.can.i.help")}
        </Typography>
        <Suggestions
          onSuggestionClicked={handleSuggestion}
          disabled={isLoading}
        />
        <ChatInput sessionId={currentSessionId} />
      </Box>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" height="100vh">
      <ChatMessages sessionId={currentSessionId} />
      <Citations citations={citations as Citation[]} />
      <ReplayStopBar
        onReplay={handleReplay}
        onStop={handleStop}
        isLoading={isLoading}
        disabled={messages.length < 2}
        onDownload={handleDownloadTranscript}
        downloadDisabled={messages.length === 0 || isExporting}
        isExporting={isExporting}
      />
      <ChatInput sessionId={currentSessionId} />
    </Box>
  );
};

export default ChatArea;