/**
 * Completion Service
 * 
 * Service for handling AI completions using Azure OpenAI.
 * Refactored from the React hook version to work as a standalone service
 * that can be used from Redux middleware, thunks, or components.
 */

import { AzureOpenAI } from "openai";

export interface CompletionConfig {
  userToken: string;
  model?: string;
  onStreamChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface CompletionResult {
  fullText: string;
  completed: boolean;
}

/**
 * Completion Service Class
 * Provides methods for interacting with Azure OpenAI completion API
 */
export class OpenAIService {
  private static getBaseURL(): string {
    return import.meta.env.VITE_API_BACKEND 
      ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` 
      : "http://localhost:5001/proxy/azure";
  }

  private static createAzureClient(userToken: string): AzureOpenAI {
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

  /**
   * Send a completion request with streaming support
   * @param messages Array of messages for the conversation
   * @param config Configuration including token and callbacks
   * @returns Promise<CompletionResult>
   */
  static async createAzureResponse(
    messages: { role: "user" | "system" | "assistant"; content: string }[], 
    config: CompletionConfig
  ): Promise<CompletionResult> {
    const { userToken, model = "gpt-4o", onStreamChunk, signal } = config;
    
    const client = this.createAzureClient(userToken);

    // Create streaming completion, using Responses, new and prefered from OpenAI SDK
    // https://platform.openai.com/docs/api-reference/chat/create
    // https://platform.openai.com/docs/api-reference/responses/create
    // https://platform.openai.com/docs/guides/migrate-to-responses
    // Currently not availalbe in Canada
    // https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/responses?tabs=python-key
    // const stream = await client.responses.stream({
    //   model,
    //   input: messages,
    // }, {
    //   signal: signal, // Support for cancellation
    //   stream: true,
    // });
    const stream = await client.chat.completions.create({
      model,
      messages,
      stream: true,
    }, {
      signal, // Support for cancellation
    });

    let fullText = "";
    
    // Process streaming chunks
    for await (const chunk of stream) {
      // Check if request was aborted
      if (signal?.aborted) {
        throw new Error('Request aborted');
      }

      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        fullText += delta;

        // Call the streaming callback if provided
        if (onStreamChunk) {
          onStreamChunk(delta);
        }
      }
    }
    // // Process streaming responses
    // for await (const event of stream) {
    //   // Check if request was aborted
    //   if (signal?.aborted) {
    //     throw new Error('Request aborted');
    //   }

    //   // Handle different event types from ResponseStreamEvent
    //   if (event.type === 'response.output_text.delta') {
    //     const deltaContent = event.delta;
    //     if (deltaContent) {
    //       fullText += deltaContent;
    //       // Call the streaming callback if provided
    //       if (onStreamChunk) {
    //         onStreamChunk(deltaContent);
    //       }
    //     }
    //   }
    //   // Handle error events
    //   else if (event.type === 'error') {
    //     throw new Error(`Stream error: ${JSON.stringify(event)}`);
    //   }
    // }

    return {
      fullText,
      completed: true,
    };
  }
}