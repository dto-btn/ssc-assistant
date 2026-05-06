/**
 * Completion Service - Provider Agnostic
 * 
 * Abstracts different AI providers (Azure OpenAI, AWS Bedrock, etc.)
 * and provides a unified interface for completions with streaming support.
 */

import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { AzureOpenAIProvider } from "./providers/azureOpenAIProvider";
import { Tool } from "openai/resources/responses/responses.mjs";
import { Citation } from "../utils/citations";

export type CompletionContentPart = Extract<
  ChatCompletionContentPart,
  { type: "text" | "image_url" }
>;

export type CompletionMessage = Extract<
  ChatCompletionMessageParam,
  { role: "system" | "user" | "assistant" }
>;

export type CompletionToolChoice = "auto" | "required" | "none";

export interface CompletionRequest {
  messages: CompletionMessage[];
  model: string;
  provider?: 'azure-openai' | 'aws-bedrock' | "goc-ai-platform";
  userToken: string;
  signal?: AbortSignal;
  servers?: Tool.Mcp[];
  currentOutput?: string;
  toolChoice?: CompletionToolChoice;
}

export interface StreamingCallbacks {
  onChunk?: (chunk: string) => void;
  onToolCall?: (toolName?: string) => void;
  onError?: (error: Error) => void;
  onComplete?: (fullText: string) => void;
}

export interface CompletionResult {
  fullText: string;
  completed: boolean;
  provider: string;
  citations?: Citation[];
  mcpToolOutputs?: CompletionMcpToolOutput[];
}

export interface CompletionMcpToolOutput {
  // Tool identifier emitted by Responses API MCP event payloads.
  toolName: string;
  // Optional server label when available in stream/final payload metadata.
  serverLabel?: string;
  // Serialized output to keep Redux payload transport-safe and inspectable.
  output: string;
}

/**
 * Base interface for completion providers
 */
export interface CompletionProvider {
  readonly name: string;
  createCompletion(
    request: CompletionRequest, 
    callbacks: StreamingCallbacks
  ): Promise<CompletionResult>;
}

/**
 * Main completion service - routes to appropriate provider
 */
export class CompletionService {
  private providers: Map<string, CompletionProvider> = new Map();

  constructor() {
    // Register default providers
    this.registerProvider(new AzureOpenAIProvider());
    // Future: this.registerProvider(new GoCLLMProvider());
  }

  /**
   * Register or replace a provider so consumers can route completions dynamically.
   */
  registerProvider(provider: CompletionProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Delegate completion creation to the requested provider, defaulting to Azure OpenAI.
   */
  async createCompletion(
    request: CompletionRequest,
    callbacks: StreamingCallbacks = {}
  ): Promise<CompletionResult> {
    const providerName = request.provider || 'azure-openai';
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new Error(`Provider '${providerName}' not found`);
    }

    return provider.createCompletion(request, callbacks);
  }

  /**
   * Return the provider registry so the UI can populate dropdowns/toggles.
   */
  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}

// Singleton instance
export const completionService = new CompletionService();