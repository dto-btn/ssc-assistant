/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult } from "../completionService";
import { callToolOnMCP, getMCPTools } from "../toolService";

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

      const tools = await getMCPTools();

      let finalToolCalls: Record<string, any> = {};

      const stream = await client.chat.completions.create({
        model,
        messages: updatedMessages,
        tools: tools,
        tool_choice: "auto",
        stream: true,
      });

      let currentId;
      let currentArguments = "";

      for await (const chunk of stream) {

        if (chunk.choices.length > 0) { 
          const choice = chunk.choices[0];

          if (choice.delta.tool_calls) { // Handle tool calls
            for (const toolCall of choice.delta.tool_calls) { // Add tool to final calls
              if (toolCall.id) { // If tool call has an ID, then it is the initial request
                finalToolCalls[toolCall.id] = toolCall;
                currentId = toolCall.id;
                currentArguments = toolCall.function?.arguments || "";
              }
              else { // No id means that this is a continuation of a tool call's arguments
                // Append arguments to existing tool call
                if (currentId && finalToolCalls[currentId]) {
                  currentArguments += toolCall.function?.arguments || "";
                  if (currentArguments.endsWith("}")) {
                    try {
                      finalToolCalls[currentId].function.arguments = JSON.parse(currentArguments);
                    } catch (e) {
                      console.error("Error parsing tool call arguments for tool call ID", currentId, ":", e);
                    }
                  }
                }
              }
            }
          }
          else { // Regular content chunk
            if (choice.delta.content) {
              fullText += choice.delta.content;
              onChunk?.(choice.delta.content);
            }
          }
        }
      }

      // Execute tool calls, append results to messages & send to LLM
      if (Object.keys(finalToolCalls).length > 0) {
        for (const callId in finalToolCalls) {
          const toolCall = finalToolCalls[callId];
          const toolArgs = toolCall.function.arguments;
          const toolResult = await callToolOnMCP(toolCall.function.name, toolArgs);
          updatedMessages = updatedMessages.concat({
            role: "system",
            content: `Tool ${toolCall.function.name} called with ID ${toolCall.id} returned: ${JSON.stringify(toolResult)}`
          });
        }

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