/**
 * Azure OpenAI Provider Implementation
 *
 * Uses stronger timeout/abort handling so orchestrator-routed calls can fail
 * fast and emit predictable errors during streamed completions.
 */

import OpenAI from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult, CompletionMessage } from "../completionService";
import { ResponseInput, Tool } from "openai/resources/responses/responses.mjs";
import {
  Citation,
  extractCitationsFromPayloadWithOptions,
  extractResponseCitations,
  mergeCitations,
} from "../../utils/citations";

const DEFAULT_RESPONSES_TIMEOUT_MS = 90000;
const DEFAULT_STANDALONE_LITELLM_BASE_URL = "http://localhost:4000/v1";
const IS_DEV = import.meta.env.DEV;

/**
 * Enable verbose citation diagnostics in development and behind the explicit env override.
 */
const isCitationDebugEnabled = (): boolean => {
  const override = String(import.meta.env.VITE_PLAYGROUND_DEBUG_CITATIONS || "").toLowerCase();
  return IS_DEV || override === "true";
};

const isPlaygroundLiteLLMEnabled = (): boolean => {
  return String(import.meta.env.VITE_PLAYGROUND_USE_LITELLM || "true").toLowerCase() === "true";
};

const resolveResponsesTimeoutMs = (): number => {
  // Environment override keeps timeout tuning deploy-specific without code edits.
  const raw = import.meta.env.VITE_AZURE_RESPONSES_TIMEOUT_MS;
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_RESPONSES_TIMEOUT_MS;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RESPONSES_TIMEOUT_MS;
  }

  return parsed;
};

const isAbortLikeError = (error: unknown): boolean => {
  // Normalizes AbortController and network-timeout variants into one predicate.
  if (!error) return false;
  const value = error as { name?: string; message?: string };
  const name = (value.name || "").toLowerCase();
  const message = (value.message || "").toLowerCase();
  return name.includes("abort") || message.includes("aborted") || message.includes("timeout");
};

/**
 * Detect PMCOE-oriented tool routes so citation extraction can reconstruct
 * missing blob paths from filenames when needed.
 */
const hasPmcoeServer = (servers: Tool.Mcp[] = []): boolean => {
  return servers.some((server) => {
    const haystack = `${server.server_label || ""} ${server.server_description || ""} ${server.server_url || ""}`.toLowerCase();
    return haystack.includes("pmcoe") || haystack.includes("project-management");
  });
};

const toSerializableToolOutput = (value: unknown): string | undefined => {
  // Keep payloads deterministic for Redux/state snapshots and debug surfaces.
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const extractMcpToolOutputs = (value: unknown): NonNullable<CompletionResult["mcpToolOutputs"]> => {
  const collected: NonNullable<CompletionResult["mcpToolOutputs"]> = [];
  const seenObjects = new WeakSet<object>();

  const visit = (node: unknown): void => {
    if (!node) {
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (typeof node !== "object") {
      return;
    }

    // Defensive: streamed SDK payloads can reuse object references across branches.
    if (seenObjects.has(node as object)) {
      return;
    }
    seenObjects.add(node as object);

    const record = node as Record<string, unknown>;

    const type = typeof record.type === "string" ? record.type : undefined;
    const status = typeof record.status === "string" ? record.status : undefined;
    const output = record.output;
    // Capture both completed calls and partial payloads that already include output.
    if (type === "mcp_call" && (status === "completed" || output !== undefined)) {
      const serializedOutput = toSerializableToolOutput(output);
      if (serializedOutput) {
        collected.push({
          toolName:
            (typeof record.name === "string" && record.name)
            || (typeof record.tool_name === "string" && record.tool_name)
            || "unknown_mcp_tool",
          serverLabel:
            (typeof record.server_label === "string" && record.server_label)
            || (typeof record.serverLabel === "string" && record.serverLabel)
            || undefined,
          output: serializedOutput,
        });
      }
    }

    for (const nested of Object.values(record)) {
      visit(nested);
    }
  };

  visit(value);
  return collected;
};

const mergeMcpToolOutputs = (
  current: NonNullable<CompletionResult["mcpToolOutputs"]>,
  incoming: NonNullable<CompletionResult["mcpToolOutputs"]>,
): NonNullable<CompletionResult["mcpToolOutputs"]> => {
  if (incoming.length === 0) {
    return current;
  }

  // Stable dedupe key keeps repeated event/finalResponse emissions from duplicating cards.
  const seen = new Set(current.map((item) => `${item.toolName}|${item.serverLabel || ""}|${item.output}`));
  const merged = [...current];

  for (const item of incoming) {
    const key = `${item.toolName}|${item.serverLabel || ""}|${item.output}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
};

export class AzureOpenAIProvider implements CompletionProvider {
  readonly name = 'azure-openai';

  private createTimeoutSignal(externalSignal?: AbortSignal): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), resolveResponsesTimeoutMs());

    const onExternalAbort = () => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", onExternalAbort, { once: true });
      }
    }

    return {
      signal: controller.signal,
      cleanup: () => {
        window.clearTimeout(timeoutId);
        if (externalSignal) {
          externalSignal.removeEventListener("abort", onExternalAbort);
        }
      },
    };
  }

  /**
   * Resolve the standalone LiteLLM proxy URL (must include `/v1`).
   */
  private getBaseURL(): string {
    if (!isPlaygroundLiteLLMEnabled()) {
      throw new Error("Playground LiteLLM proxy is disabled (set VITE_PLAYGROUND_USE_LITELLM=true).");
    }

    const configured = String(import.meta.env.VITE_PLAYGROUND_LITELLM_BASE_URL || "").trim();
    const base = configured.length > 0 ? configured : DEFAULT_STANDALONE_LITELLM_BASE_URL;
    return base.replace(/\/$/, "");
  }

  /**
   * Build an OpenAI-compatible client for standalone LiteLLM proxy.
   * Uses dedicated proxy key when configured, otherwise falls back to user token.
   */
  private createClient(userToken: string): OpenAI {
    const proxyKey = String(import.meta.env.VITE_PLAYGROUND_LITELLM_PROXY_KEY || "").trim();
    const authToken = proxyKey.length > 0 ? proxyKey : userToken.trim();
    const defaultHeaders = {
      "Authorization": "Bearer " + authToken,
      "x-caller-system": "ssc-assistant",
      "x-caller-component": "ssc-assistant-playground",
    };

    return new OpenAI({
      baseURL: this.getBaseURL(),
      apiKey: "#no-thank-you",
      dangerouslyAllowBrowser: true,
      defaultHeaders,
    });
  }

  /**
   * Convert CompletionMessage array to ResponseInput format.
   * Key Changes: 
   *  - type name from text & image_url to input_text & input_image
   *  - taking nested image_url properties (url & detail) out one level
   */
  private convertMessagesToInput(messages: CompletionMessage[]): ResponseInput {

    return messages.map((msg) => {
      if (Array.isArray(msg.content)) {
        // Handle content as array of CompletionContentPart
        const contentArray = msg.content.map((part) => {
          if (part.type === "text") {
            return { type: "input_text", text: part.text };
          } else if (part.type === "image_url") {
            return { type: "input_image", image_url: part.image_url.url, detail: part.image_url.detail };
          } else {
            throw new Error(`Unsupported content part type: ${part.type}`);
          }
        });
        return {
          role: msg.role,
          content: contentArray,
        }
      }
      else {
        // Handle content as simple string
        return {
          role: msg.role,
          content: msg.content || "",
        }
      }
    }) as ResponseInput;
  }

  /**
   * Stream chat completions, optionally executing tool calls before recursively resuming the run.
   */
  async createCompletion(
    request: CompletionRequest,
    callbacks: StreamingCallbacks
  ): Promise<CompletionResult> {
    const { messages, userToken, model, signal, servers, currentOutput, toolChoice } = request;
    const { onChunk, onToolCall, onError, onComplete } = callbacks;

    let fullText = currentOutput || "";
    let citations: Citation[] = [];
    let mcpToolOutputs: CompletionResult["mcpToolOutputs"] = [];
    const citationDebugEnabled = isCitationDebugEnabled();
    const seenEventTypes = new Set<string>();
    const timeout = this.createTimeoutSignal(signal);
    // PMCOE routes sometimes emit filenames without a concrete URL, so pass
    // inference hints into payload-based citation extraction.
    const citationExtractionOptions = {
      enablePmcoePathInference: hasPmcoeServer(servers),
      pmcoeContainer: String(import.meta.env.VITE_PMCOE_CONTAINER || "").trim() || undefined,
    };
    
    try {
      const updatedMessages = this.convertMessagesToInput(messages);

      const client = this.createClient(userToken);

      const stream = await client.responses.stream({
        model: model,
        input: updatedMessages,
        ...(servers && servers.length > 0 ? { tools: servers, tool_choice: toolChoice ?? "auto" } : {}),
      }, { signal: timeout.signal });

      for await (const event of stream) {
        const eventRecord = event as { type?: string };
        if (typeof eventRecord.type === "string" && eventRecord.type.length > 0) {
          seenEventTypes.add(eventRecord.type);
        }

        // Stream annotations can arrive before finalResponse is materialized,
        // so merge citations continuously instead of relying on the final payload.
        const extractedFromEvent = extractCitationsFromPayloadWithOptions(event, citationExtractionOptions);
        citations = mergeCitations(citations, extractedFromEvent);
        mcpToolOutputs = mergeMcpToolOutputs(mcpToolOutputs, extractMcpToolOutputs(event));

        if (citationDebugEnabled && extractedFromEvent.length > 0) {
          console.debug("[playground-citations] extracted from stream event", {
            eventType: eventRecord.type,
            extractedCount: extractedFromEvent.length,
            extractedCitations: extractedFromEvent,
            rawEvent: event,
          });
        }

        if (event.type === "response.output_text.delta") {
          fullText += event.delta;
          onChunk?.(event.delta);
        }

        else if (event.type === "response.mcp_call.in_progress") {
          // Keep provider event logging behind the citation debug flag and avoid
          // logging full raw events in normal runs.
          console.log("Tool call in progress:", event);
          onToolCall?.();
        }
      }

      if (typeof stream.finalResponse === "function") {
        const finalResponse = await stream.finalResponse();
        mcpToolOutputs = mergeMcpToolOutputs(mcpToolOutputs, extractMcpToolOutputs(finalResponse));

        // Some providers only attach complete annotation graphs on the finalized
        // response object, so merge that pass on top of stream-level extraction.
        const extractedFromFinalResponse = extractResponseCitations(finalResponse);
        const extractedFromFinalPayload = extractCitationsFromPayloadWithOptions(finalResponse, citationExtractionOptions);
        citations = mergeCitations(citations, extractedFromFinalResponse);
        citations = mergeCitations(citations, extractedFromFinalPayload);

        if (citationDebugEnabled && (extractedFromFinalResponse.length > 0 || extractedFromFinalPayload.length > 0)) {
          console.debug("[playground-citations] extracted from final response", {
            extractedFromFinalResponse: extractedFromFinalResponse.length,
            extractedFromFinalPayload: extractedFromFinalPayload.length,
            extractedCitations: mergeCitations(extractedFromFinalResponse, extractedFromFinalPayload),
            rawFinalResponse: finalResponse,
          });
        }
      }

      if (citationDebugEnabled) {
        console.debug("[playground-citations] completion summary", {
          citationCount: citations.length,
          citations,
          containsDocMarkers: /\[doc\d+\]/i.test(fullText),
          eventTypesSeen: Array.from(seenEventTypes),
        });
      }

      onComplete?.(fullText);

      return {
        fullText,
        completed: true,
        provider: this.name,
        citations,
        mcpToolOutputs,
      };
    } catch (error) {
      // If the user explicitly aborted (Stop button), propagate the original
      // AbortError unchanged so callers can distinguish it from a real timeout.
      // Calling onError for an intentional stop would produce misleading logs.
      if (signal?.aborted) {
        throw error;
      }

      let err = error instanceof Error ? error : new Error(String(error));
      if (isAbortLikeError(error)) {
        err = new Error(
          servers && servers.length > 0
            ? "Playground request timed out while waiting for MCP tool execution."
            : "Playground request timed out before completion."
        );
      }
      onError?.(err);
      throw err;
    } finally {
      timeout.cleanup();
    }
  }
}