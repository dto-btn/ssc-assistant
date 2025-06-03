import OpenAI from "openai";

export type AgentCoreLlmClientConnectionEvent =
    | AgentCoreLlmClientConnectionEvent.Message
    | AgentCoreLlmClientConnectionEvent.Close
    | AgentCoreLlmClientConnectionEvent.StreamingMessageUpdate;

export namespace AgentCoreLlmClientConnectionEvent {
    /**
     * Represents the first message sent by the LLM client connection.
     * This message contains the initial chat completion message from the LLM.
     */
    export interface Message {
        type: 'message';
        data: OpenAI.Chat.Completions.ChatCompletionMessage
    }

    export interface Close {
        type: 'close';
        data: 
            | { ok: true }
            | { ok: false; error: unknown };
    }

    export interface StreamingMessageUpdate {
        type: 'streaming-message-update';
        data: {
            content: string; // Accumulated content from the stream
        }
    }
}
