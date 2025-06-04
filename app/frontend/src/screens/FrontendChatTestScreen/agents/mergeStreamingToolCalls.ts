import { OpenAI } from 'openai';

/**
 * Interface representing a chunk from the streaming_tool_calls.json file
 */
interface StreamingToolCallChunk {
    choices: Array<{
        content_filter_results?: Record<string, any>;
        delta?: {
            content?: string;
            refusal?: null | string;
            role?: string;
            tool_calls?: Array<{
                index?: number;
                id?: string;
                type?: string;
                function?: {
                    name?: string;
                    arguments?: string;
                }
            }>;
        };
        finish_reason?: string | null;
        index?: number;
        logprobs?: any;
    }>;
    created?: number;
    id?: string;
    model?: string;
    object?: string;
    system_fingerprint?: string;
    prompt_filter_results?: Array<{
        prompt_index?: number;
        content_filter_results?: Record<string, any>;
    }>;
}

/**
 * Interface representing an accumulated message with its components
 */
interface AccumulatedMessage {
    role: string;
    content: string | null;
    tool_calls?: Array<{
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        }
    }>;
}

/**
 * Merges streaming chunks from the OpenAI API into a complete message.
 * This function handles the incremental building of a complete message from
 * streaming chunks, including tool calls that may come in pieces.
 * 
 * @param chunks - Array of StreamingToolCallChunk objects from streaming_tool_calls.json
 * @returns The complete merged message with all content and tool calls
 */
export function mergeStreamingToolCalls(chunks: StreamingToolCallChunk[]): AccumulatedMessage {
    // Initialize the accumulated message
    const accumulatedMessage: AccumulatedMessage = {
        role: 'assistant',
        content: '',
        tool_calls: []
    };

    // Used to track tool calls by their id
    const toolCallsMap = new Map<string, {
        id: string;
        type: string;
        function: {
            name: string;
            arguments: string;
        }
    }>();

    // Process each chunk
    for (const chunk of chunks) {
        // Skip chunks without choices
        if (!chunk.choices || chunk.choices.length === 0) {
            continue;
        }

        const choice = chunk.choices[0];
        
        // Skip if no delta is present
        if (!choice.delta) {
            continue;
        }
        
        const delta = choice.delta;
        
        // Handle role assignment (usually only in first chunk)
        if (delta.role) {
            accumulatedMessage.role = delta.role;
        }
        
        // Accumulate content
        if (delta.content !== undefined) {
            // Initialize content as empty string if it's null
            if (accumulatedMessage.content === null) {
                accumulatedMessage.content = '';
            }
            
            accumulatedMessage.content += delta.content;
        }
        
        // Handle tool calls
        if (delta.tool_calls && delta.tool_calls.length > 0) {
            // If we have tool calls, content should be null according to the OpenAI API spec
            accumulatedMessage.content = null;
            
            // Process each tool call delta
            for (const toolCallDelta of delta.tool_calls) {
                // Skip if the tool call has no useful information
                if (!toolCallDelta || (!toolCallDelta.id && !toolCallDelta.function)) {
                    continue;
                }
                
                // Get the tool call ID or create a placeholder if missing
                const toolCallId = toolCallDelta.id || `temp_id_${Math.random().toString(36).substring(2, 9)}`;
                
                // Get or create the tool call in our map
                let toolCall = toolCallsMap.get(toolCallId);
                if (!toolCall) {
                    toolCall = {
                        id: toolCallId,
                        type: 'function',
                        function: {
                            name: '',
                            arguments: ''
                        }
                    };
                    toolCallsMap.set(toolCallId, toolCall);
                }
                
                // Update the tool call with new information
                if (toolCallDelta.type) {
                    toolCall.type = toolCallDelta.type;
                }
                
                if (toolCallDelta.function) {
                    if (toolCallDelta.function.name) {
                        toolCall.function.name += toolCallDelta.function.name;
                    }
                    
                    if (toolCallDelta.function.arguments) {
                        toolCall.function.arguments += toolCallDelta.function.arguments;
                    }
                }
            }
        }
    }
    
    // Convert the tool calls map to an array
    accumulatedMessage.tool_calls = Array.from(toolCallsMap.values());
    
    // If no tool calls were found, remove the property
    if (accumulatedMessage.tool_calls.length === 0) {
        delete accumulatedMessage.tool_calls;
    }
    
    return accumulatedMessage;
}

/**
 * Utility function to load and merge streaming tool calls from a JSON file
 * 
 * @param jsonData - Array of streaming tool call chunks
 * @returns The merged message
 */
export function mergeToolCallsFromJson(jsonData: StreamingToolCallChunk[]): AccumulatedMessage {
    return mergeStreamingToolCalls(jsonData);
}

/**
 * Processes a JSON file containing streaming tool calls
 * 
 * @param filePath - Path to the JSON file
 * @returns Promise that resolves to the merged message
 */
export async function processStreamingToolCallsFile(filePath: string): Promise<AccumulatedMessage> {
    try {
        // This would be used in a browser environment
        const response = await fetch(filePath);
        const jsonData: StreamingToolCallChunk[] = await response.json();
        return mergeStreamingToolCalls(jsonData);
    } catch (error) {
        console.error('Error processing streaming tool calls file:', error);
        throw error;
    }
}
