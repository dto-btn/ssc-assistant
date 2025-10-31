/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult } from "../completionService";
import { callToolOnMCP } from "../toolService";
import { ChatCompletionFunctionTool } from "openai/resources/index.mjs";

const TOOLS: ChatCompletionFunctionTool[] = [
          {
            type: "function",
            function: {
              name: "list_all_mps",
              description: "List all Canadian Members of Parliament",
              parameters: {
                type: "object",
                properties: {},
                required: []
              }
            },
          },
          {
            type: "function",
            function: {
              name: "get_total_mps",
              description: "Get the total number of Canadian Members of Parliament",
              parameters: {
                type: "object",
                properties: {},
                required: []
              }
            }
          }
        ];

export class AzureOpenAIProvider implements CompletionProvider {
  readonly name = 'azure-openai';

  private getBaseURL(): string {
    return import.meta.env.VITE_API_BACKEND 
      ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` 
      : "http://localhost:5001/proxy/azure";
  }

  private createClient(userToken: string): AzureOpenAI {
    return new AzureOpenAI({
      baseURL: this.getBaseURL(),
      apiKey: "#no-thank-you",
      apiVersion: "2024-05-01-preview",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "Authorization": "Bearer " + userToken.trim(),
      }
    });
  }

  async createCompletion(
    request: CompletionRequest,
    callbacks: StreamingCallbacks
  ): Promise<CompletionResult> {
    const { messages, userToken, model, signal } = request;
    const { onChunk, onError, onComplete } = callbacks;

    let fullText = "";
    let updatedMessages = messages;
    
    try {
      const client = this.createClient(userToken);

      // TODO Integrate tool definitions dynamically
      const resp = await client.chat.completions.create({
        model,
        messages: updatedMessages,
        tools: TOOLS,
        tool_choice: "auto",
      });


      // TODO Handle multiple choices if necessary
      const choice = JSON.parse(resp).choices[0];

      const toolCalls = choice.message.tool_calls || [];

      // Handle tool calls if any
      while (toolCalls.length > 0) {
        console.log("Tool calls requested:", toolCalls);        

        // For each tool call, get result and aggregate to feed back into chat completion
        for (const toolCall of toolCalls) {
          const toolArgs = JSON.parse(toolCall.function.arguments);
          const toolResult = await callToolOnMCP(toolCall.function.name, toolArgs);
          console.log("Tool result:", toolResult);
          updatedMessages = updatedMessages.concat({
            role: "system",
            content: `Tool ${toolCall.function.name} called with ID ${toolCall.id} returned: ${JSON.stringify(toolResult)}`
          });
        }

        console.log("Updated messages after tool calls:", updatedMessages);

        // Create a new completion request with the updated messages
        const newRequest: CompletionRequest = {
          messages: updatedMessages,
          userToken,
          model,
          signal
        };

        // Call the createCompletion method again with the new request
        return this.createCompletion(newRequest, callbacks);
      }

      //TODO Handle streaming chunks
      fullText += choice.message.content || "";
      console.log("Completion response received:", fullText);
      onChunk?.(fullText);
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