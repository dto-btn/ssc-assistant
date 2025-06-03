import OpenAI from "openai";
import { AgentCoreLlmClient } from "./AgentCoreLlmClient";
import { AgentCoreLlmClientConnection } from "./AgentCoreLlmClientConnection";
import { mergeOpenAiDelta } from "./AgentCoreLlmClientStreaming.utils";

export class AgentCoreLlmClientStreaming implements AgentCoreLlmClient {
    constructor(private openai: OpenAI) {}

    createChatCompletion(
        body: OpenAI.Chat.Completions.ChatCompletionCreateParams,
        options?: OpenAI.RequestOptions
    ): AgentCoreLlmClientConnection {
        // Create a new connection object
        const cnx = new AgentCoreLlmClientConnection();
        
        // Add stream parameter to ensure streaming mode
        const streamingBody: OpenAI.Chat.Completions.ChatCompletionCreateParams = { 
            ...body, 
            stream: true 
        };
        
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
            
            // Create an accumulator for the final message that will be properly structured
            let messageAcc: Partial<OpenAI.Chat.Completions.ChatCompletionMessage> = {
                role: 'assistant',
                content: '',
                tool_calls: []
            };
            
            // Track if we're currently accumulating tool calls
            let isProcessingToolCall = false;
            
            // Process each chunk from the stream
            for await (const chunk of stream) {
                try {
                    const choice = chunk.choices[0];
                    
                    if (!choice) {
                        console.warn("Received chunk without choices, skipping");
                        continue;
                    }

                    if (!choice.delta) {
                        console.warn("Received chunk without delta, skipping");
                        continue;
                    }
                    
                    const delta = choice.delta;
                    
                    // Handle content updates
                    if (delta.content !== undefined) {
                        contentAcc += delta.content;
                        messageAcc.content = contentAcc;
                        
                        // Only emit streaming updates for non-tool content
                        if (!isProcessingToolCall) {
                            cnx.triggerEvent({
                                type: 'streaming-message-update',
                                data: {
                                    content: contentAcc
                                }
                            });
                        }
                    }
                    
                    // Handle tool call updates
                    if (delta.tool_calls) {
                        isProcessingToolCall = true;
                        
                        // Initialize tool_calls array if needed
                        if (!messageAcc.tool_calls) {
                            messageAcc.tool_calls = [];
                        }
                        
                        // Process each tool call delta
                        delta.tool_calls.forEach((toolCallDelta, index) => {
                            // Initialize corresponding tool call in accumulator if needed
                            if (!messageAcc.tool_calls![index]) {
                                messageAcc.tool_calls![index] = {
                                    id: toolCallDelta.id || `call_${index}`,
                                    type: 'function',
                                    function: {
                                        name: '',
                                        arguments: ''
                                    }
                                };
                            }
                            
                            // Update tool call with delta information
                            const accToolCall = messageAcc.tool_calls![index];
                            
                            if (toolCallDelta.function) {
                                if (toolCallDelta.function.name) {
                                    accToolCall.function.name += toolCallDelta.function.name;
                                }
                                
                                if (toolCallDelta.function.arguments) {
                                    accToolCall.function.arguments += toolCallDelta.function.arguments;
                                }
                            }
                        });
                    }
                    
                    // Merge the deltas into the accumulator
                    mergeOpenAiDelta(messageAcc, delta);
                } catch (chunkError) {
                    console.error("Error processing chunk:", chunkError);
                    // Continue processing other chunks even if one fails
                }
            }
            
            // Emit the final message
            if (messageAcc.tool_calls && messageAcc.tool_calls.length > 0) {
                // If we have tool calls, make sure content is null to ensure proper handling
                messageAcc.content = null;
            }
            
            cnx.triggerEvent({
                type: 'message',
                data: messageAcc as OpenAI.Chat.Completions.ChatCompletionMessage
            });
            
            // Close the connection normally
            cnx.close();
        } catch (error) {
            console.error("Error creating streaming chat completion:", error);
            cnx.close(error);
        }
    }
}
