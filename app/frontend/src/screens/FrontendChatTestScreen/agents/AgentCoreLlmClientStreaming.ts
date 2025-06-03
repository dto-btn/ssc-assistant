import OpenAI from "openai";
import { AgentCoreLlmClient } from "./AgentCoreLlmClient";
import { AgentCoreLlmClientConnection } from "./AgentCoreLlmClientConnection";
import { mergeDelta } from "./AgentCoreLlmClientStreaming.utils";

export class AgentCoreLlmClientStreaming implements AgentCoreLlmClient {
    constructor(private openai: OpenAI) {}

    createChatCompletion(
        body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
        options?: OpenAI.RequestOptions
    ): AgentCoreLlmClientConnection {
        // Create a new connection object
        const cnx = new AgentCoreLlmClientConnection();
        
        // Add stream parameter to ensure streaming mode
        const streamingBody: OpenAI.Chat.Completions.ChatCompletionCreateParams = { ...body, stream: true };
        
        // Start the streaming process asynchronously
        this.createChatCompletionAsync(cnx, streamingBody, options);
        
        // Return the connection object immediately
        return cnx;
    }

    private async createChatCompletionAsync(
        cnx: AgentCoreLlmClientConnection,
        body: OpenAI.Chat.Completions.ChatCompletionCreateParams & { stream: true },
        options?: OpenAI.RequestOptions
    ): Promise<void> {
        try {
            // Create a streaming completion request
            const stream = await this.openai.chat.completions.create(body, options);
            
            // Initialize accumulators for the complete message
            let contentAcc = '';
            let deltaAcc: OpenAI.Chat.Completions.ChatCompletionChunk.Choice.Delta = {};
            
            // Process each chunk from the stream
            for await (const chunk of stream) {
                const choice = chunk.choices[0];

                if (!choice?.delta) {
                    console.warn("Received chunk without delta, skipping:", chunk);
                    continue;
                }
                
                // Accumulate the message & emit it as an incoming text stream
                if (choice.delta.content) {
                    contentAcc += choice.delta.content;
                    cnx.triggerEvent({
                        type: 'streaming-message-update',
                        data: {
                            content: contentAcc
                        }
                    })
                }

                // Merge the deltas.
                mergeDelta(deltaAcc, choice.delta);
            }
            
            // Emit the final message
            cnx.triggerEvent({
                type: 'message',
                data: deltaAcc as OpenAI.Chat.Completions.ChatCompletionMessage
            });
            
            // Close the connection normally
            cnx.close();
        } catch (error) {
            console.error("Error creating streaming chat completion:", error);
            cnx.close(error);
        }
    }
}
