/**
 * Example: Using CompletionService in Redux
 * 
 * This file shows examples of how to use the refactored CompletionService
 * in Redux middleware, thunks, or other non-React contexts.
 */

import { CompletionService, CompletionMessage } from "./completionService";

/**
 * Example 1: Simple completion function for use in Redux thunks
 */
export async function sendCompletionMessage(
  messages: CompletionMessage[],
  userToken: string,
  onStreamChunk?: (chunk: string) => void
): Promise<string> {
  try {
    const result = await CompletionService.createCompletion(messages, {
      userToken,
      onStreamChunk,
    });
    
    return result.fullText;
  } catch (error) {
    console.error('Completion failed:', error);
    throw error;
  }
}

/**
 * Example 2: For use in Redux middleware - with cancellation support
 */
export async function sendCompletionWithCancellation(
  messages: CompletionMessage[],
  userToken: string,
  options: {
    onStreamChunk?: (chunk: string) => void;
    signal?: AbortSignal;
    model?: string;
  } = {}
): Promise<string> {
  const result = await CompletionService.createCompletion(messages, {
    userToken,
    model: options.model || "gpt-4o",
    onStreamChunk: options.onStreamChunk,
    signal: options.signal,
  });
  
  return result.fullText;
}

/**
 * Example 3: Utility function to build conversation messages
 */
export function buildConversation(
  systemPrompt?: string,
  userMessage?: string,
  previousMessages: CompletionMessage[] = []
): CompletionMessage[] {
  const messages: CompletionMessage[] = [...previousMessages];
  
  if (systemPrompt && messages.length === 0) {
    messages.push(CompletionService.createSystemMessage(systemPrompt));
  }
  
  if (userMessage) {
    messages.push(CompletionService.createUserMessage(userMessage));
  }
  
  return messages;
}

/**
 * Example 4: For streaming usage in middleware
 */
export class StreamingCompletionManager {
  private abortController: AbortController | null = null;
  
  async startCompletion(
    messages: CompletionMessage[],
    userToken: string,
    callbacks: {
      onChunk: (chunk: string) => void;
      onComplete: (fullText: string) => void;
      onError: (error: Error) => void;
    }
  ): Promise<void> {
    // Cancel any existing completion
    this.cancel();
    
    // Create new abort controller
    this.abortController = new AbortController();
    
    try {
      const result = await CompletionService.createCompletion(messages, {
        userToken,
        onStreamChunk: callbacks.onChunk,
        signal: this.abortController.signal,
      });
      
      callbacks.onComplete(result.fullText);
    } catch (error) {
      if (error instanceof Error) {
        callbacks.onError(error);
      }
    } finally {
      this.abortController = null;
    }
  }
  
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
  
  isActive(): boolean {
    return this.abortController !== null;
  }
}