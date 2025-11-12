/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult } from "../completionService";
import { getToolService } from "../toolService";

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
    const { messages, userToken, model, signal, tools, currentOutput } = request;
    const { onChunk, onToolCall, onError, onComplete } = callbacks;

    let fullText = currentOutput || "";
    let updatedMessages = messages;
    
    try {
      const client = this.createClient(userToken);

      const toolService = await getToolService();

      let finalToolCalls: Record<string, any> = {};

      const stream = await client.chat.completions.create({
        model,
        messages: updatedMessages,
        ...(tools && tools.length > 0 ? { tools: tools, tool_choice: "auto" } : {}),
        stream: true,
      });

      let currentId: string = "";
      let currentArguments: string = "";

      // Process the streaming response
      for await (const chunk of stream) {

        if (chunk.choices.length > 0) { 
          const choice = chunk.choices[0]; // Assuming single choice for simplicity

          if (choice.delta.tool_calls) { // Handle tool calls if present

            for (const toolCall of choice.delta.tool_calls) { // Add tool to final calls

              if (toolCall.id) { // If tool call has an ID, then it is the initial chunk

                // If there was a previous tool call being built, finalize its arguments
                if (currentId !== "" && finalToolCalls[currentId] && currentArguments !== "") {
                  console.log("Finalizing tool call arguments for tool call ID", currentId);
                  try {
                    finalToolCalls[currentId].function.arguments = JSON.parse(currentArguments);
                  } catch (e) {
                    console.error("Error parsing tool call arguments for tool call ID", currentId, ":", e);
                  }
                }

                // Add new tool call to final calls, initialize arguments
                finalToolCalls[toolCall.id] = toolCall;
                currentId = toolCall.id;
                currentArguments = toolCall.function?.arguments || "";
              }
              else { // No id means that this is a continuation of a tool call's arguments
                // Append arguments to existing tool call
                if (currentId && finalToolCalls[currentId]) {
                  currentArguments += toolCall.function?.arguments || "";
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

      // Finalize the last tool call if any
      if (currentId !== "" && finalToolCalls[currentId] && currentArguments !== "") {
        try {
          finalToolCalls[currentId].function.arguments = JSON.parse(currentArguments);
        } catch (e) {
          console.error("Error parsing tool call arguments for tool call ID", currentId, ":", e);
        }
      }
      
      // Execute tool calls if requested, append results to messages & send to LLM
      if (Object.keys(finalToolCalls).length > 0) {
        for (const callId in finalToolCalls) {
          const toolCall = finalToolCalls[callId];
          onToolCall?.(toolCall.function.name);
          const toolArgs = toolCall.function.arguments;
          const toolResult = await toolService.callTool(toolCall.function.name, toolArgs);
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
          signal,
          tools,
          currentOutput: fullText,
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