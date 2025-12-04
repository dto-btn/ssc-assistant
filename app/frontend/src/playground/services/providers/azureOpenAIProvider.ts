/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult, CompletionMessage } from "../completionService";
import { getToolService } from "../toolService";
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
      console.log("Creating Azure OpenAI client with user token:", userToken);

      const client = this.createClient(userToken);

      const toolService = await getToolService(userToken);

      let finalToolCalls: Record<string, any> = {};

      const stream = await client.responses.stream({
        model: model,
        input: updatedMessages,
        // tools: [
        //   {
        //     type: "mcp",
        //     server_label: "Canadian Parliament MCP Server",
        //     server_description: "MCP server hosting tools for fetching data about Canadian Members of Parliament (MPs).",
        //     server_url: "https://testcaontinerapp.blackground-73a376b6.canadacentral.azurecontainerapps.io/mcp",
        //     require_approval: "never",
        //     authorization: "Bearer " + userToken.trim(),
        //   },
        // ],
        // tool_choice: "auto",
      }, { signal });

      console.log("response = ", stream)

      // Text deltas
      stream.on("response.output_text.delta", (e) => {
        console.log("Received text delta:", e.delta);
        fullText += e.delta;
        onChunk?.(e.delta);
      });


      onChunk?.("\ncompleted.")
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