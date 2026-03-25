/**
 * Azure OpenAI Provider Implementation
 *
 * Uses stronger timeout/abort handling so orchestrator-routed calls can fail
 * fast and emit predictable errors during streamed completions.
 */

import OpenAI from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult, CompletionMessage } from "../completionService";
import { ResponseInput } from "openai/resources/responses/responses.mjs";

const DEFAULT_RESPONSES_TIMEOUT_MS = 90000;
const LITELLM_PROXY_BASE_PATH = "/proxy/litellm/v1";

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
   * Resolve the backend URL for the embedded LiteLLM OpenAI-compatible path.
   */
  private getBaseURL(): string {
    if (!isPlaygroundLiteLLMEnabled()) {
      throw new Error("Playground LiteLLM proxy is disabled (set VITE_PLAYGROUND_USE_LITELLM=true).");
    }

    const backend = import.meta.env.VITE_API_BACKEND
      ? String(import.meta.env.VITE_API_BACKEND).replace(/\/$/, "")
      : "http://localhost:5001";

    return `${backend}${LITELLM_PROXY_BASE_PATH}`;
  }

  /**
   * Build an Azure OpenAI SDK client that forwards the user's token via Authorization.
   */
  private createClient(userToken: string): OpenAI {
    const defaultHeaders = {
      "Authorization": "Bearer " + userToken.trim(),
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
    const { messages, userToken, model, signal, servers, currentOutput } = request;
    const { onChunk, onToolCall, onError, onComplete } = callbacks;

    let fullText = currentOutput || "";
    const timeout = this.createTimeoutSignal(signal);
    
    try {
      const updatedMessages = this.convertMessagesToInput(messages);

      const client = this.createClient(userToken);

      const stream = await client.responses.stream({
        model: model,
        input: updatedMessages,
        ...(servers && servers.length > 0 ? { tools: servers, tool_choice: "auto" } : {}),
      }, { signal: timeout.signal });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          fullText += event.delta;
          onChunk?.(event.delta);
        }

        else if (event.type === "response.mcp_call.in_progress") {
          console.log("Tool call in progress:", event);
          onToolCall?.();
        }
      }

      onComplete?.(fullText);

      return {
        fullText,
        completed: true,
        provider: this.name,
      };
    } catch (error) {
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