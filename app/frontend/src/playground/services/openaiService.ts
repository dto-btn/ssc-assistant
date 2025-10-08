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

    try {
      // Create streaming completion, using Responses, new and prefered from OpenAI SDK
      // https://platform.openai.com/docs/api-reference/chat/create
      // https://platform.openai.com/docs/api-reference/responses/create
      const stream = await client.responses.create({
        model,
        input: messages,
        stream: true
      }, {
        signal, // Support for cancellation
      });

      let fullText = "";
      
      // Process streaming responses
      for await (const response of stream) {
        // Check if request was aborted
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        if(response.type === 'response.output_text.delta') {
          // Call the streaming callback if provided
          if (onStreamChunk) {
            onStreamChunk(response.delta);
          }
        }
      }

      return {
        fullText,
        completed: true,
      };
    } catch (error) {
      // Handle different types of errors
      if (error instanceof Error) {
        if (error.name === 'AbortError' || error.message === 'Request aborted') {
          throw new Error('Completion request was cancelled');
        }
      }
      
      // Re-throw other errors
      throw error;
    }
  }
}