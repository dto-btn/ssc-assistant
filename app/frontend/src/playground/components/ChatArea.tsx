/**
 * ChatArea component
 *
 * Renders the main chat area for the playground including messages and
 * metadata such as citations and feedback controls. Exports a React
 * component used by `PlaygroundRoot`/`Playground`.
 *
 * Embeds orchestrator activity/debug panels and keeps archive rehydration in
 * sync when remote session files change.
 */

import React from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { Box, Typography, useTheme, useMediaQuery, CircularProgress } from "@mui/material";
import Suggestions from "./Suggestions";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import { useTranslation } from 'react-i18next';
import { fetchFileDataUrl } from "../api/storage";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";
import OrchestratorDebugPanel from "./OrchestratorDebugPanel";
import TopBar from "./TopBar";
import { useAppSelector } from "../store/hooks";
import type { AttachmentExportData, PlaygroundExportFormat, SessionExportAttachment } from "../export/sessionExport";
import { addToast } from "../store/slices/toastSlice";
import { useSessionRehydration } from "../hooks/useSessionRehydration";

/**
 * Optional controls passed from layout so ChatArea can reopen a hidden sidebar.
 */
interface ChatAreaProps {
  onOpenSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  onOpenSidebar,
  isSidebarOpen,
}) => {
  const { t } = useTranslation('playground');
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useAppSelector(
    (state) => state.sessions.currentSessionId
  );
  const isLoading = useAppSelector((state) =>
    currentSessionId ? (state.chat.isLoadingBySessionId[currentSessionId] ?? false) : false
  );
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  // Use memoized selector for messages
  const messages = useAppSelector(selectMessagesBySessionId);
  const sessionFiles = useAppSelector(selectCurrentSessionFiles);
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const isNewChat = useAppSelector((state) => 
    state.sessions.sessions.find(s => s.id === currentSessionId)?.isNewChat ?? false
  );
  const [isExporting, setIsExporting] = React.useState(false);

  // Session archive rehydration managed by dedicated hook.
  const { isRehydrated } = useSessionRehydration(currentSessionId);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileSidebarOpen = useAppSelector((state) => state.ui.isMobileSidebarOpen);

  /**
   * Renders the brand TopBar with sidebar toggle.
   */
  const renderHeader = () => {
    return (
      <Box display="flex" alignItems="center" width="100%">
        <Box flexGrow={1} minWidth={0}>
          <TopBar 
            onToggleSidebar={onOpenSidebar} 
            isSidebarOpen={isSidebarOpen}
            isMobile={isMobile}
            isMobileSidebarOpen={isMobileSidebarOpen}
            onExport={handleExport}
            isExportDisabled={!currentSessionId}
            isExporting={isExporting}
          />
        </Box>
      </Box>
    );
  };

  const handleExport = React.useCallback(async (format: PlaygroundExportFormat) => {
    if (!currentSessionId) {
      dispatch(addToast({
        message: t("export.disabled.noSession", {
          defaultValue: "Select a chat to export",
        }),
        isError: true,
      }));
      return;
    }

    const activeSession = sessions.find((session) => session.id === currentSessionId);
    if (!activeSession) {
      dispatch(addToast({
        message: t("export.failed", {
          defaultValue: "Could not export this chat.",
        }),
        isError: true,
      }));
      return;
    }

    setIsExporting(true);
    try {
      const {
        buildSessionExportDocument,
        downloadSessionExportJson,
        downloadSessionExportPdf,
        downloadSessionExportWord,
      } = await import("../export/sessionExport");

      const exportDocument = buildSessionExportDocument({
        session: activeSession,
        messages,
        sessionFiles,
      });

      const resolveAttachmentData = async (
        attachment: SessionExportAttachment,
      ): Promise<AttachmentExportData | null> => {
        if (!accessToken?.trim()) {
          return null;
        }

        try {
          const result = await fetchFileDataUrl({
            fileUrl: attachment.url || undefined,
            blobName: attachment.blobName || undefined,
            fileType: attachment.contentType || undefined,
            accessToken,
          });

          const base64 = result.dataUrl.split(",")[1] || "";
          if (!base64) {
            return null;
          }

          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let index = 0; index < binary.length; index += 1) {
            bytes[index] = binary.charCodeAt(index);
          }

          return {
            bytes,
            contentType: result.contentType || attachment.contentType || "application/octet-stream",
          };
        } catch {
          return null;
        }
      };

      if (format === "json") {
        downloadSessionExportJson(activeSession.name, exportDocument);
      } else if (format === "pdf") {
        await downloadSessionExportPdf(activeSession.name, exportDocument, resolveAttachmentData);
      } else {
        await downloadSessionExportWord(activeSession.name, exportDocument);
      }

      dispatch(addToast({
        message: t(`export.success.${format}`, {
          defaultValue: `Chat exported as ${format.toUpperCase()}.`,
        }),
        isError: false,
      }));
    } catch (error) {
      console.error("Failed to export session", error);
      dispatch(addToast({
        message: t("export.failed", {
          defaultValue: "Could not export this chat.",
        }),
        isError: true,
      }));
    } finally {
      setIsExporting(false);
    }
  }, [accessToken, currentSessionId, dispatch, messages, sessionFiles, sessions, t]);

  /**
   * Convert a canned suggestion into a user turn for quick-start prompts.
   */
  const handleSuggestion = (suggestion: string): void => {
    dispatch(
      sendAssistantMessage({
        sessionId: currentSessionId!,
        content: suggestion,
      })
    );
  };


  if (!currentSessionId) {
    return (
      <Box flex={1} display="flex" flexDirection="column" height="100dvh" minWidth={0}>
        {renderHeader()}
        <Box
          component="main"
          flex={1}
          display="flex"
          alignItems="center"
          justifyContent="center"
          minWidth={0}
        >
          <Typography component="h1" variant="body1">
            {t("select.or.create.session")}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Hydration state check:
  // If we have messages, always show messages.
  // If no messages but it's an old chat that hasn't finished hydrating yet, show a loader.
  const isHydrating =
    Boolean(accessToken)
    && !isNewChat
    && messages.length === 0
    && !isRehydrated;
  const hydrationStatusMessageId = "chat-hydration-status-message";

  if (isHydrating) {
    return (
      <Box flex={1} display="flex" flexDirection="column" height="100dvh" minWidth={0}>
        {renderHeader()}
        <Box
          component="main"
          flex={1}
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          aria-busy="true"
          minWidth={0}
        >
          <CircularProgress size={40} sx={{ mb: 2 }} aria-describedby={hydrationStatusMessageId} />
          <Typography id={hydrationStatusMessageId} variant="body1" color="text.secondary">
            {t("loading.chat", { defaultValue: "Restoring chat history..." })}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        component="main"
        flex={1}
        display="flex"
        flexDirection="column"
        height="100dvh"
        minWidth={0}
      >
        {renderHeader()}
        <Box flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={{ xs: 2, sm: 4, md: 6 }} minWidth={0}>
          <Typography component="h1" variant="h3" gutterBottom>
            {t("how.can.i.help")}
          </Typography>
          <Typography
            component="p"
            variant="body1"
            align="center"
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", sm: "600px", md: "800px" },
              mb: { xs: 2, sm: 3, md: 4 },
              px: { xs: 1, sm: 2 },
              lineHeight: 1.7,
              color: "text.primary",
            }}
          >
            {t("how.can.i.help.description")}
          </Typography>
          <Suggestions
            onSuggestionClicked={handleSuggestion}
            disabled={isLoading}
          />
          <OrchestratorDebugPanel sessionId={currentSessionId} />
        </Box>
        <ChatInput sessionId={currentSessionId} />
      </Box>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" height="100dvh" minWidth={0}>
      {renderHeader()}
      <Box component="main" display="flex" flexDirection="column" flex={1} minHeight={0} minWidth={0}>
        {/* WCAG 1.3.1 / page-has-heading-one: the empty-state branches each supply an
            h1, but this active-chat branch has no visible heading. A visually-hidden h1
            keeps axe happy and gives screen-reader users a page title landmark. */}
        <Typography
          component="h1"
          sx={{
            position: "absolute",
            width: "1px",
            height: "1px",
            overflow: "hidden",
            clip: "rect(0,0,0,0)",
            whiteSpace: "nowrap",
          }}
        >
          {t("chat.transcript", { defaultValue: "Chat conversation" })}
        </Typography>
        <ChatMessages sessionId={currentSessionId} />
        <OrchestratorDebugPanel sessionId={currentSessionId} />
        <ChatInput sessionId={currentSessionId} />
      </Box>
    </Box>
  );
};

export default ChatArea;