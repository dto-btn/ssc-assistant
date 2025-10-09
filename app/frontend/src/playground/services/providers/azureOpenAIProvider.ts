/**
 * Azure OpenAI Provider Implementation
 */

import { AzureOpenAI } from "openai";
import { CompletionProvider, CompletionRequest, StreamingCallbacks, CompletionResult } from "../completionService";

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
    
    try {
      const client = this.createClient(userToken);

      const stream = await client.chat.completions.create({
        model,
        messages,
        stream: true,
      }, {
        signal,
      });

      let fullText = "";
      
      for await (const chunk of stream) {
        if (signal?.aborted) {
          throw new Error('Request aborted');
        }

        const delta = chunk.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          fullText += delta;
          onChunk?.(delta);
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