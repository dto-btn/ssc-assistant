/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult, CompletionMessage } from "../completionService";
import { ResponseInput } from "openai/resources/responses/responses.mjs";

export class AzureOpenAIProvider implements CompletionProvider {
  readonly name = 'azure-openai';

  /**
   * Resolve the backend proxy URL so browser calls stay within the same origin.
   */
  private getBaseURL(): string {
    return import.meta.env.VITE_API_BACKEND 
      ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` 
      : "http://localhost:5001/proxy/azure";
  }

  /**
   * Build an Azure OpenAI SDK client that forwards the user's token via Authorization.
   */
  private createClient(userToken: string): AzureOpenAI {
    return new AzureOpenAI({
      baseURL: this.getBaseURL(),
      apiKey: "#no-thank-you",
      apiVersion: "2025-03-01-preview",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "Authorization": "Bearer " + userToken.trim(),
      }
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
    
    try {
      const updatedMessages = this.convertMessagesToInput(messages);

      const client = this.createClient(userToken);

      const stream = await client.responses.stream({
        model: model,
        input: updatedMessages,
        ...(servers && servers.length > 0 ? { tools: servers, tool_choice: "auto" } : {}),
      }, { signal });

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
      const err = error instanceof Error ? error : new Error(String(error));
      onError?.(err);
      throw err;
    }
  }
}