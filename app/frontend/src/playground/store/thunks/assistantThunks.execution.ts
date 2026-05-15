/**
 * Execution lifecycle helpers for assistant turns.
 *
 * Contains reusable runtime steps that were previously inlined in the thunk:
 * - streaming completion execution
 * - citation-grounded rewrite pass
 * - standalone citation harvesting
 * - final response reveal/typewriter phase
 */
import {
  setAssistantResponsePhase,
  updateMessageContent,
} from "../slices/chatSlice";
import {
  completionService,
  CompletionMessage,
  CompletionResult,
} from "../../services/completionService";
import { Citation } from "../../utils/citations";
import { Tool } from "openai/resources/responses/responses.mjs";
import i18n from "../../../i18n";
import { createStreamTypewriter } from "../../utils/streamTypewriter";
import {
  FINAL_REVEAL_BURST_MULTIPLIER,
  FINAL_REVEAL_CHARS_PER_TICK,
  FINAL_REVEAL_MAX_BUFFERED_CHARS,
  FINAL_REVEAL_MAX_WAIT_MS,
  FINAL_REVEAL_TICK_MS,
  IS_CITATION_DEBUG_ENABLED,
  IS_DEV,
  MAX_GROUNDED_REWRITE_EXCERPT_CHARS,
  MCP_CITATION_HARVEST_SYSTEM_PROMPT,
  MCP_GROUNDED_REWRITE_SYSTEM_PROMPT,
  shouldRequireToolsForRun,
  stripToolCallStatusMessages,
  truncateText,
} from "./assistantThunksHelpers";

export type ResolvedAssistantAnswer = {
  content: string;
  citations: CompletionResult["citations"];
};

export type BufferedCompletionRun = {
  completionResult?: CompletionResult;
  resolvedAnswer: ResolvedAssistantAnswer;
  wasAborted: boolean;
};

type CreateAssistantExecutionHelpersArgs = {
  sessionId: string;
  latestAssistantMessageId: string;
  content: string;
  completionModel: string;
  provider: "azure-openai" | "aws-bedrock";
  accessToken: string;
  abortController: AbortController;
  dispatch: any;
};

export const createAssistantExecutionHelpers = ({
  sessionId,
  latestAssistantMessageId,
  content,
  completionModel,
  provider,
  accessToken,
  abortController,
  dispatch,
}: CreateAssistantExecutionHelpersArgs) => {
  // Build a user-visible stop marker when a response is cancelled mid-stream.
  const buildStoppedContent = (nextContent: string): string => {
    const stopMarker = `\n\n*${i18n.t("playground:assistant.stopped")}*`;
    return nextContent.length > 0 ? nextContent + stopMarker : stopMarker.trimStart();
  };

  const maybeRewriteAnswerWithCitations = async (
    draftText: string,
    citations: CompletionResult["citations"],
  ): Promise<ResolvedAssistantAnswer> => {
    // No citations means there is nothing to ground/rewrite.
    if (!draftText.trim() || !citations?.length) {
      return { content: draftText, citations };
    }

    const seenEvidence = new Set<string>();
    // Build a compact source pack for the rewrite call, deduplicated by url+excerpt.
    const evidenceBlocks = citations
      .filter((citation) => typeof citation.content === "string" && citation.content.trim().length > 0)
      .filter((citation) => {
        const evidenceKey = `${citation.url}|${citation.content}`;
        if (seenEvidence.has(evidenceKey)) {
          return false;
        }
        seenEvidence.add(evidenceKey);
        return true;
      })
      .map((citation, index) => {
        const title = String(citation.title || citation.url || `Source ${index + 1}`).trim();
        const excerpt = truncateText(citation.content!.trim(), MAX_GROUNDED_REWRITE_EXCERPT_CHARS);
        const location = String(citation.url || "").trim();

        return [
          `Source ${index + 1}: ${title}`,
          location ? `Location: ${location}` : undefined,
          `Excerpt:\n${excerpt}`,
        ]
          .filter((value): value is string => Boolean(value && value.trim().length > 0))
          .join("\n");
      });

    if (evidenceBlocks.length === 0) {
      return { content: draftText, citations };
    }

    try {
      const rewriteResult = await completionService.createCompletion(
        {
          messages: [
            { role: "system", content: MCP_GROUNDED_REWRITE_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                "Revise the assistant draft using only the source excerpts below.",
                `Original user request:\n${content.trim()}`,
                `Assistant draft:\n${draftText.trim()}`,
                `Source excerpts:\n${evidenceBlocks.join("\n\n")}`,
                "Return only the revised answer in the same language as the draft answer.",
              ].join("\n\n"),
            },
          ],
          model: completionModel,
          provider,
          userToken: accessToken,
          signal: abortController.signal,
          servers: [],
        },
        {
          onChunk: () => undefined,
          onToolCall: () => undefined,
          onError: (error: Error) => {
            if (!abortController.signal.aborted && IS_DEV) {
              console.warn("Citation-grounded rewrite failed:", error);
            }
          },
          onComplete: () => undefined,
        }
      );

      const rewrittenText = rewriteResult.fullText.trim();
      if (!rewrittenText) {
        return { content: draftText, citations };
      }

      return {
        content: rewrittenText,
        citations: citations.map((citation) => ({
          title: citation.title,
          url: citation.url,
          content: citation.content,
        })),
      };
    } catch (rewriteError) {
      if (!abortController.signal.aborted && IS_DEV) {
        console.warn("Citation-grounded rewrite failed:", rewriteError);
      }
      return { content: draftText, citations };
    }
  };

  const revealAssistantAnswer = async (
    answer: ResolvedAssistantAnswer,
    options?: { immediate?: boolean },
  ): Promise<void> => {
    // For aborted/empty outputs, skip animation and write final content directly.
    if (options?.immediate || !answer.content.trim()) {
      dispatch(
        updateMessageContent({
          messageId: latestAssistantMessageId,
          content: answer.content,
          citations: answer.citations,
        })
      );
      return;
    }

    if (abortController.signal.aborted) {
      dispatch(
        updateMessageContent({
          messageId: latestAssistantMessageId,
          content: buildStoppedContent(""),
          citations: answer.citations,
        })
      );
      return;
    }

    dispatch(setAssistantResponsePhase({ sessionId, phase: "streaming" }));

    // Reveal uses the same typewriter utility as streaming UI, but for finalized text.
    const revealTypewriter = createStreamTypewriter({
      tickMs: FINAL_REVEAL_TICK_MS,
      charsPerTick: FINAL_REVEAL_CHARS_PER_TICK,
      burstMultiplier: FINAL_REVEAL_BURST_MULTIPLIER,
      maxBufferedChars: FINAL_REVEAL_MAX_BUFFERED_CHARS,
      onUpdate: (nextText) => {
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessageId,
            content: nextText,
            citations: answer.citations,
          })
        );
      },
    });

    let wasAbortedDuringReveal = false;
    const handleAbortDuringReveal = (): void => {
      wasAbortedDuringReveal = true;
      revealTypewriter.stop();
    };

    abortController.signal.addEventListener("abort", handleAbortDuringReveal, { once: true });

    try {
      revealTypewriter.enqueue(answer.content);
      await revealTypewriter.complete({ maxWaitMs: FINAL_REVEAL_MAX_WAIT_MS });
      const revealedContent = revealTypewriter.getDisplayedText();
      dispatch(
        updateMessageContent({
          messageId: latestAssistantMessageId,
          content: wasAbortedDuringReveal ? buildStoppedContent(revealedContent) : answer.content,
          citations: answer.citations,
        })
      );
    } finally {
      abortController.signal.removeEventListener("abort", handleAbortDuringReveal);
      revealTypewriter.stop();
    }
  };

  const harvestStandaloneCitations = async (
    promptText: string,
    draftText: string,
    serversForRun: Tool.Mcp[],
  ): Promise<Citation[]> => {
    // Harvest is optional and only useful when we have both prompt text and available servers.
    if (!promptText.trim() || serversForRun.length === 0) {
      return [];
    }

    try {
      const harvestResult = await completionService.createCompletion(
        {
          messages: [
            { role: "system", content: MCP_CITATION_HARVEST_SYSTEM_PROMPT },
            {
              role: "user",
              content: [
                "Retrieve authoritative source excerpts and citations for the request below.",
                `User request:\n${promptText.trim()}`,
                draftText.trim() ? `Current assistant draft:\n${draftText.trim()}` : undefined,
                "Use the available MCP tools. Review all relevant sources returned by the MCP server before responding.",
                "Return evidence from all relevant source documents, aiming for multiple distinct sources when available.",
                "Prefer official sources and source excerpts, and do not stop after the first matching source.",
              ]
                .filter((value): value is string => Boolean(value && value.trim().length > 0))
                .join("\n\n"),
            },
          ],
          model: completionModel,
          provider,
          userToken: accessToken,
          signal: abortController.signal,
          servers: serversForRun,
          toolChoice: "required",
        },
        {
          onChunk: () => undefined,
          onToolCall: () => undefined,
          onError: (error: Error) => {
            if (!abortController.signal.aborted && IS_DEV) {
              console.warn("Standalone citation harvest failed:", error);
            }
          },
          onComplete: () => undefined,
        }
      );

      return harvestResult.citations || [];
    } catch (harvestError) {
      if (!abortController.signal.aborted && IS_DEV) {
        console.warn("Standalone citation harvest failed:", harvestError);
      }
      return [];
    }
  };

  const runCompletion = async (
    messagesForRun: CompletionMessage[],
    serversForRun: Tool.Mcp[],
  ): Promise<BufferedCompletionRun> => {
    // This run buffers chunks, then performs one final state update after optional rewrite.
    let receivedFirstChunk = false;
    let bufferedDraftText = "";

    let completionResult: CompletionResult | undefined;

    try {
      completionResult = await completionService.createCompletion(
        {
          messages: messagesForRun,
          model: completionModel,
          provider,
          userToken: accessToken,
          servers: serversForRun,
          signal: abortController.signal,
          toolChoice: shouldRequireToolsForRun(serversForRun) ? "required" : undefined,
        },
        {
          onChunk: (chunk: string) => {
            bufferedDraftText += chunk;
            if (!receivedFirstChunk) {
              receivedFirstChunk = true;
              dispatch(setAssistantResponsePhase({ sessionId, phase: "drafting" }));
            }
          },
          onToolCall: () => undefined,
          onError: (error: Error) => {
            if (abortController.signal.aborted) return;
            if (IS_DEV) {
              console.error("Streaming error:", error);
            }
          },
          onComplete: () => undefined,
        }
      );
    } catch (error) {
      if (!abortController.signal.aborted) {
        throw error;
      }
    }

    const wasAborted = abortController.signal.aborted;
    const resolvedContent = bufferedDraftText.trim().length > 0
      ? bufferedDraftText
      : (completionResult?.fullText || bufferedDraftText);
    const cleanedContent = stripToolCallStatusMessages(resolvedContent);

    if (!receivedFirstChunk && !wasAborted && cleanedContent.trim().length > 0) {
      dispatch(setAssistantResponsePhase({ sessionId, phase: "drafting" }));
    }

    if (IS_CITATION_DEBUG_ENABLED) {
      console.debug("[playground-citations] litellm completion result", {
        provider,
        model: completionModel,
        citationCount: completionResult?.citations?.length ?? 0,
        citations: completionResult?.citations ?? [],
      });
    }

    const finalContent = wasAborted ? buildStoppedContent(cleanedContent) : cleanedContent;
    const rewrittenAnswer = wasAborted
      ? { content: finalContent, citations: completionResult?.citations }
      : await maybeRewriteAnswerWithCitations(cleanedContent, completionResult?.citations);

    return {
      completionResult,
      resolvedAnswer: rewrittenAnswer,
      wasAborted,
    };
  };

  return {
    harvestStandaloneCitations,
    maybeRewriteAnswerWithCitations,
    revealAssistantAnswer,
    runCompletion,
  };
};
