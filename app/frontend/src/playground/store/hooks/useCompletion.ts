/**
 * Completion Hooks
 * 
 * React hooks that wrap the CompletionService for easy use in components.
 * These hooks provide the same interface as the original useCompletion but
 * use the refactored service underneath.
 */

import { useCallback, useRef } from "react";
import { CompletionService, CompletionMessage } from "../../services/completionService";

/**W
 * Hook for using the completion service in React components
 * Provides the same interface as the original useCompletion hook
 */
export function useCompletion() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const createAzure = useCallback(async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, 
    userToken: string,
    options?: {
      model?: string;
      onStreamChunk?: (chunk: string) => void;
    }
  ): Promise<string> => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const result = await CompletionService.createCompletion(
        messages as CompletionMessage[],
        {
          userToken,
          model: options?.model,
          onStreamChunk: options?.onStreamChunk,
          signal: abortControllerRef.current.signal,
        }
      );

      return result.fullText;
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancelCompletion = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  return { 
    createAzure,
    cancelCompletion,
  };
}

/**
 * Hook for streaming completions with more control
 */
export function useStreamingCompletion() {
  const abortControllerRef = useRef<AbortController | null>(null);

  const startCompletion = useCallback(async (
    messages: CompletionMessage[],
    userToken: string,
    options: {
      model?: string;
      onStreamChunk: (chunk: string) => void;
      onComplete?: (fullText: string) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    try {
      const result = await CompletionService.createCompletion(messages, {
        userToken,
        model: options.model,
        onStreamChunk: options.onStreamChunk,
        signal: abortControllerRef.current.signal,
      });

      if (options.onComplete) {
        options.onComplete(result.fullText);
      }
    } catch (error) {
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }
    } finally {
      abortControllerRef.current = null;
    }
  }, []);

  const cancelCompletion = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const isActive = useCallback(() => {
    return abortControllerRef.current !== null;
  }, []);

  return {
    startCompletion,
    cancelCompletion,
    isActive,
  };
}