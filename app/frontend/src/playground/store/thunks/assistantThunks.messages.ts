/**
 * Message preparation helpers.
 *
 * Responsible for chart system prompts, attachment hydration/caching, and
 * conversion of Redux chat messages into provider completion messages.
 */
import { addToast } from "../slices/toastSlice";
import { Message } from "../slices/chatSlice";
import {
  CompletionMessage,
  CompletionContentPart,
} from "../../services/completionService";
import { AppDispatch } from "..";
import type { RootState } from "..";
import i18n from "../../../i18n";
import { FileAttachment } from "../../types";
import { extractFileText, fetchFileDataUrl } from "../../api/storage";

const ATTACHMENT_TEXT_LIMIT = 12000;

const PLAYGROUND_CHART_SYSTEM_PROMPT_EN = "When the user asks for a chart, graph, diagram, flowchart, sequence diagram, gantt, timeline, pie chart, bar chart, or a similar visual, respond with Mermaid markdown by default using a fenced ```mermaid block. Use renderer-stable Mermaid syntax only (for example: pie, graph/flowchart, sequenceDiagram, stateDiagram, classDiagram, gantt, timeline). Avoid experimental or often-invalid directives such as xychart-beta unless the user explicitly requests that syntax. Keep Mermaid syntax valid and complete with no placeholders. For bar-chart requests, if a stable Mermaid bar chart syntax is not available, provide the closest valid Mermaid diagram plus a compact bullet list of label:value pairs. Do not return Python, matplotlib, seaborn, plotly, pandas, or JavaScript chart code unless the user explicitly asks for executable code.";
const PLAYGROUND_CHART_SYSTEM_PROMPT_FR = "Lorsque l'utilisateur demande un graphique, un diagramme, un organigramme, un diagramme de sequence, un diagramme de Gantt, une chronologie, un graphique circulaire, un graphique en barres ou un autre visuel semblable, repondez par defaut avec du Markdown Mermaid dans un bloc delimite ```mermaid. Utilisez seulement une syntaxe Mermaid stable pour le rendu (par exemple: pie, graph/flowchart, sequenceDiagram, stateDiagram, classDiagram, gantt, timeline). Evitez les directives experimentales ou souvent invalides comme xychart-beta, sauf si l'utilisateur demande explicitement cette syntaxe. La syntaxe Mermaid doit etre complete et valide. Pour les demandes de graphique en barres, si une syntaxe Mermaid stable n'est pas disponible, fournissez le diagramme Mermaid valide le plus proche et une liste compacte de paires etiquette:valeur. Ne retournez pas de code Python, matplotlib, seaborn, plotly, pandas ou JavaScript sauf si l'utilisateur demande explicitement du code executable.";

const attachmentTextCache = new Map<string, string>();
const attachmentImageCache = new Map<string, string>();

export const FINAL_REVEAL_TICK_MS = 25;
export const FINAL_REVEAL_CHARS_PER_TICK = 10;
export const FINAL_REVEAL_BURST_MULTIPLIER = 3;
export const FINAL_REVEAL_MAX_BUFFERED_CHARS = 360;
export const FINAL_REVEAL_MAX_WAIT_MS = 4500;
export const IS_DEV = import.meta.env.DEV;
export const IS_CITATION_DEBUG_ENABLED = String(import.meta.env.VITE_PLAYGROUND_DEBUG_CITATIONS || "").toLowerCase() === "true";

export const buildPlaygroundChartSystemMessage = (): CompletionMessage => ({
  role: "system",
  content: i18n.language?.toLowerCase().startsWith("fr")
    ? PLAYGROUND_CHART_SYSTEM_PROMPT_FR
    : PLAYGROUND_CHART_SYSTEM_PROMPT_EN,
});

export const truncateText = (text: string, maxLength: number): string => {
  // Clamp large extracted documents to protect completion token budget.
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n\n[Attachment truncated after ${maxLength} characters of ${text.length}.]`;
};

async function resolveAttachmentParts(
  attachments: FileAttachment[] = [],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionContentPart[]> {
  // Resolve each attachment to text/image completion parts with per-file caching.
  const parts: CompletionContentPart[] = [];
  const extractionFailures: string[] = [];
  const emptyExtractions: string[] = [];
  const state = getState();
  const accessToken = state.auth?.accessToken ?? null;

  for (const attachment of attachments) {
    const cacheKey = attachment.blobName || attachment.url;
    const contentType = attachment.contentType ?? undefined;
    const attachmentName = attachment.originalName || attachment.blobName || "attachment";

    if (contentType?.startsWith("image/")) {
      let dataUrl = cacheKey ? attachmentImageCache.get(cacheKey) : undefined;

      if (!dataUrl && (attachment.url || attachment.blobName)) {
        try {
          const result = await fetchFileDataUrl({
            fileUrl: attachment.url,
            blobName: attachment.blobName,
            fileType: contentType,
            accessToken,
          });
          dataUrl = result.dataUrl;
          if (dataUrl && cacheKey) {
            attachmentImageCache.set(cacheKey, dataUrl);
          }
        } catch (error) {
          if (IS_DEV) {
            console.error("Failed to load attachment image", error);
          }
        }
      }

      if (!dataUrl) {
        continue;
      }

      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" is an image. Please describe what you see in the image and use that context when answering the user's request.`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
          detail: "auto",
        },
      });
      continue;
    }

    let resolvedText = cacheKey ? attachmentTextCache.get(cacheKey) : undefined;

    if (!resolvedText && attachment.url) {
      try {
        resolvedText = await extractFileText({
          fileUrl: attachment.url,
          fileType: contentType,
        });
        if (resolvedText && cacheKey) {
          attachmentTextCache.set(cacheKey, resolvedText);
        }
      } catch (error) {
        if (IS_DEV) {
          console.error("Failed to extract attachment text", error);
        }
        extractionFailures.push(attachmentName);
      }
    }

    if (!resolvedText) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" could not be read. Let the user know the file might need to be converted to a different format (for example, CSV or XLSX).`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const trimmed = resolvedText.trim();
    if (!trimmed) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" did not contain readable text. Ask the user for a different format if the data seems important.`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const limited = truncateText(trimmed, ATTACHMENT_TEXT_LIMIT);

    parts.push({
      type: "text",
      text: `Attachment "${attachmentName}" contents:\n\n${limited}`,
    });
  }

  if (extractionFailures.length || emptyExtractions.length) {
    const problems = [...new Set([...extractionFailures, ...emptyExtractions])];
    const message = i18n.t("playground:errors.attachmentExtractionFailed", {
      defaultValue: "Could not read these files: {{files}}.",
      files: problems.join(", "),
    });
    dispatch(
      addToast({
        message,
        isError: true,
      })
    );
  }

  return parts;
}

const buildMessageContent = async (
  message: Message,
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<string | CompletionContentPart[]> => {
  // User message text remains first, with attachments appended as multimodal parts.
  const baseText = message.content?.trim() ?? "";
  const attachmentParts = message.attachments?.length
    ? await resolveAttachmentParts(message.attachments, dispatch, getState)
    : [];

  if (!attachmentParts.length) {
    return baseText;
  }

  const contentParts: CompletionContentPart[] = [];

  if (baseText) {
    contentParts.push({ type: "text", text: baseText });
  }

  contentParts.push(...attachmentParts);

  return contentParts;
};

export const mapMessagesForCompletion = async (
  messages: Message[],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionMessage[]> => {
  // Convert Redux chat message shape into provider-specific completion payload.
  return Promise.all(
    messages.map(async (message) => {
      const content = await buildMessageContent(message, dispatch, getState);
      if (message.role === "system") {
        const systemContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const systemMessage: CompletionMessage = {
          role: "system",
          content: systemContent,
        };

        return systemMessage;
      }

      if (message.role === "assistant") {
        const assistantContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const assistantMessage: CompletionMessage = {
          role: "assistant",
          content: assistantContent,
        };

        return assistantMessage;
      }

      const userMessage: CompletionMessage = {
        role: "user",
        content,
      };

      return userMessage;
    })
  );
};
