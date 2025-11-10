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
import { Box, Typography } from "@mui/material";
import { addMessage, setIsLoading, hydrateSessionMessages } from "../store/slices/chatSlice";
import type { Message } from "../store/slices/chatSlice";
import Suggestions from "./Suggestions";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { useTranslation } from 'react-i18next';
import { listSessionFiles, fetchFileDataUrl } from "../api/storage";
import { setSessionFiles } from "../store/slices/sessionFilesSlice";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import type { FileAttachment } from "../types";

const ChatArea: React.FC = () => {
  const { t } = useTranslation('playground');
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector(
    (state: RootState) => state.sessions.currentSessionId
  );
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const loadedSessionsRef = React.useRef<Set<string>>(new Set());
  const rehydratedSessionsRef = React.useRef<Set<string>>(new Set());
  const rehydratingSessionsRef = React.useRef<Set<string>>(new Set());

  // Use memoized selector for messages
  const messages = useSelector(selectMessagesBySessionId);
  const sessionFiles = useSelector(selectCurrentSessionFiles);

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

  // Replay sends the previous user message again
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

  // Stop sets loading to false (simulate abort)
  const handleStop = (): void => {
    dispatch(setIsLoading(false));
  };

  // Suggestions logic
  const handleSuggestion = (suggestion: string): void => {
    dispatch(
      addMessage({
        sessionId: currentSessionId!,
        role: "user",
        content: suggestion,
      })
    );
  };

  // Load persisted attachments the first time a session becomes active so
  // previews and cached metadata are ready before the user scrolls.
  React.useEffect(() => {
    if (!currentSessionId || !accessToken) return undefined;
    if (loadedSessionsRef.current.has(currentSessionId)) return undefined;

    let cancelled = false;
    (async () => {
      try {
        // eslint-disable-next-line no-console
        console.debug("Loading session files", { sessionId: currentSessionId });
        const files = await listSessionFiles({ sessionId: currentSessionId, accessToken });
        if (cancelled) return;
        dispatch(setSessionFiles({ sessionId: currentSessionId, files }));
        loadedSessionsRef.current.add(currentSessionId);
        // eslint-disable-next-line no-console
        console.debug("Loaded session files", { sessionId: currentSessionId, fileCount: files.length });
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to load session files", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, accessToken, dispatch]);

  // Automatically rehydrate archived chats when a session has no local messages.
  React.useEffect(() => {
    if (!currentSessionId) return undefined;
    if (messages.length > 0) return undefined;
    if (sessionFiles.length === 0) return undefined;
    if (rehydratedSessionsRef.current.has(currentSessionId)) return undefined;
    if (rehydratingSessionsRef.current.has(currentSessionId)) return undefined;

    const chatArchives = sessionFiles.filter(isChatArchiveAttachment);
    if (chatArchives.length === 0) return undefined;

    const latestArchive = pickLatestArchive(chatArchives);
    if (!latestArchive || (!latestArchive.url && !latestArchive.blobName)) {
      rehydratedSessionsRef.current.add(currentSessionId);
      return undefined;
    }

    // eslint-disable-next-line no-console
    console.debug("Attempting chat restore", {
      sessionId: currentSessionId,
      archiveCount: chatArchives.length,
      latestHasUrl: Boolean(latestArchive.url),
      latestHasBlob: Boolean(latestArchive.blobName),
    });

  rehydratingSessionsRef.current.add(currentSessionId);
  let cancelled = false;
  // Track whether we restored anything so we can short-circuit future attempts for the session.
  let hasRestored = false;

    (async () => {
      try {
        const { dataUrl } = await fetchFileDataUrl({
          fileUrl: latestArchive.url,
          blobName: latestArchive.blobName,
          fileType: latestArchive.contentType ?? undefined,
          accessToken,
        });
        if (cancelled) return;
        if (!dataUrl) return;

        const decoded = decodeArchiveDataUrl(dataUrl);
        const parsed = JSON.parse(decoded) as { messages?: unknown[] };
        const restoredMessages = Array.isArray(parsed.messages)
          ? parsed.messages
              .map((entry) => normalizeArchiveMessage(entry, currentSessionId))
              .filter((msg): msg is Message => Boolean(msg))
          : [];

        if (restoredMessages.length > 0) {
          dispatch(hydrateSessionMessages({ sessionId: currentSessionId, messages: restoredMessages }));
          hasRestored = true;
          // eslint-disable-next-line no-console
          console.debug("Restored chat archive", {
            sessionId: currentSessionId,
            messageCount: restoredMessages.length,
          });
        }
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to restore chat archive", error);
        }
      } finally {
        rehydratingSessionsRef.current.delete(currentSessionId);
        if (!cancelled && (hasRestored || chatArchives.length === 0)) {
          rehydratedSessionsRef.current.add(currentSessionId);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, currentSessionId, dispatch, messages.length, sessionFiles]);

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
      />
      <ChatInput sessionId={currentSessionId} />
    </Box>
  );
};

function isChatArchiveAttachment(file: FileAttachment): boolean {
  const metadataType = file.metadataType?.toLowerCase();
  if (metadataType === "chat-archive") {
    return true;
  }
  const category = file.category?.toLowerCase();
  if (category !== "chat") {
    return false;
  }
  const name = file.originalName || file.blobName;
  return typeof name === "string" && name.endsWith(".chat.json");
}

function pickLatestArchive(files: FileAttachment[]): FileAttachment | undefined {
  return [...files].sort((a, b) => {
    const aSource = a.lastUpdated || a.uploadedAt;
    const bSource = b.lastUpdated || b.uploadedAt;
    const aTime = aSource ? Date.parse(aSource) : 0;
    const bTime = bSource ? Date.parse(bSource) : 0;
    return bTime - aTime;
  })[0];
}

function decodeArchiveDataUrl(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function normalizeArchiveMessage(candidate: unknown, sessionId: string): Message | null {
  if (!candidate || typeof candidate !== "object") {
    return null;
  }
  const record = candidate as Record<string, unknown>;

  const rawRole = (record.role ?? record.author ?? record.type) as unknown;
  let role: Message["role"] | null = null;
  if (rawRole === "assistant" || rawRole === "system") {
    role = rawRole;
  } else if (rawRole === "user" || rawRole === "human" || rawRole === "client") {
    role = "user";
  } else if (rawRole === "bot" || rawRole === "assistant_bot") {
    role = "assistant";
  }
  if (!role) {
    return null;
  }

  const possibleContent = [
    record.content,
    record.text,
    record.body,
    (typeof record.message === "string" ? record.message : undefined),
  ];
  const content = possibleContent.find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!content) {
    return null;
  }

  const rawTimestamp = record.timestamp;
  let timestamp: number;
  if (typeof rawTimestamp === "number" && Number.isFinite(rawTimestamp)) {
    timestamp = rawTimestamp;
  } else if (typeof rawTimestamp === "string") {
    const parsed = Date.parse(rawTimestamp);
    timestamp = Number.isNaN(parsed) ? Date.now() : parsed;
  } else {
    timestamp = Date.now();
  }

  const id =
    typeof record.id === "string" && record.id
      ? record.id
      : typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `restored-${sessionId}-${timestamp}-${Math.random().toString(36).slice(2)}`;

  const attachments = Array.isArray(record.attachments)
    ? (record.attachments as Message["attachments"])
    : undefined;
  const citations = Array.isArray(record.citations)
    ? (record.citations as Message["citations"])
    : undefined;

  return {
    id,
    sessionId,
    role,
    content,
    timestamp,
    attachments,
    citations,
  };
}

export default ChatArea;