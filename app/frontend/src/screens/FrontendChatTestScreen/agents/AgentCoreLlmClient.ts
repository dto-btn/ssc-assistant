import OpenAI from "openai";
import { AgentCoreLlmClientConnection } from "./AgentCoreLlmClientConnection";

/**
 * Interface for LLM client implementations that defines the common methods
 * for both streaming and non-streaming clients.
 */
export interface AgentCoreLlmClient {
    /**
     * Creates a chat completion using the LLM and returns a connection that will be
     * populated with the results asynchronously.
     * 
     * @param body The parameters for the chat completion
     * @param options Optional request options
     * @returns A connection that will emit events as the completion progresses
     */
    createChatCompletion(
        body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
        options?: OpenAI.RequestOptions
    ): AgentCoreLlmClientConnection;
}
