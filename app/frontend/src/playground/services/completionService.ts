/**
 * Completion Service
 * 
 * Service for handling AI completions using Azure OpenAI.
 * Refactored from the React hook version to work as a standalone service
 * that can be used from Redux middleware, thunks, or components.
 */

import { AzureOpenAI } from "openai";

// Types for the service
export interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

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
export class CompletionService {
  private static getBaseURL(): string {
    return import.meta.env.VITE_API_BACKEND 
      ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` 
      : "http://localhost:5001/proxy/azure";
  }

  private static createClient(userToken: string): AzureOpenAI {
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
  static async createCompletion(
    messages: CompletionMessage[], 
    config: CompletionConfig
  ): Promise<CompletionResult> {
    const { userToken, model = "gpt-4o", onStreamChunk, signal } = config;
    
    const client = this.createClient(userToken);

    try {
      // Create streaming completion
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
          // Call the streaming callback if provided
          if (onStreamChunk) {
            console.log('Streaming chunk:', delta);
            onStreamChunk(delta);
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

  /**
   * Send a completion request without streaming (legacy support)
   * @param messages Array of messages for the conversation
   * @param userToken User authentication token
   * @param model Model to use (defaults to gpt-4o)
   * @returns Promise<string> The complete response text
   */
  static async createCompletionSync(
    messages: CompletionMessage[], 
    userToken: string, 
    model: string = "gpt-4o"
  ): Promise<string> {
    const result = await this.createCompletion(messages, {
      userToken,
      model,
    });
    
    return result.fullText;
  }

  /**
   * Utility method to create a user message
   * @param content The message content
   * @returns CompletionMessage
   */
  static createUserMessage(content: string): CompletionMessage {
    return { role: "user", content };
  }

  /**
   * Utility method to create a system message
   * @param content The system prompt content
   * @returns CompletionMessage
   */
  static createSystemMessage(content: string): CompletionMessage {
    return { role: "system", content };
  }

  /**
   * Utility method to create an assistant message
   * @param content The assistant response content
   * @returns CompletionMessage
   */
  static createAssistantMessage(content: string): CompletionMessage {
    return { role: "assistant", content };
  }
}