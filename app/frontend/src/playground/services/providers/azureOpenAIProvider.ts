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
   * Stream chat completions, optionally executing tool calls before recursively resuming the run.
   */
  async createCompletion(
    request: CompletionRequest,
    callbacks: StreamingCallbacks
  ): Promise<CompletionResult> {
    const { messages, userToken, model, signal, tools, currentOutput } = request;
    const { onChunk, onToolCall, onError, onComplete } = callbacks;

    let fullText = currentOutput || "";
    let updatedMessages = messages as ResponseInput;
    
    try {
      const client = this.createClient(userToken);

      // const newTools = [];

      const stream = await client.responses.stream({
        model: model,
        input: updatedMessages,
        tools: [
          {
            type: "mcp",
            server_label: "cpMCP",
            server_description: "MCP server hosting tools for fetching data about Canadian Members of Parliament (MPs).",
            server_url: "https://ssca-mcp-server.blackground-73a376b6.canadacentral.azurecontainerapps.io/mcp",
            require_approval: "never",
            authorization: userToken,
          },
        ],
        tool_choice: "auto",
      }, { signal });

      for await (const event of stream) {
        if (event.type === "response.output_text.delta") {
          fullText += event.delta;
          onChunk?.(event.delta);
        }

        // if (event.type === "response.output_item.done") {
        //   newTools.push(event.item);
        // }

        console.log("Received event:", event);
      }

      // TODO: REMEMBER THAT WE ARE USING 4o, BUT SAYS WE NEED 4.1 FOR MCP TOOLS
      // 1. Handle tool calls by detecting tool call events from the stream
      // 2. Store tool calls for future conversations? It will be stored in context, new chats will not have it.
      // 3. Pass servers through config, not hardcoded
      // 4. Remove old code


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