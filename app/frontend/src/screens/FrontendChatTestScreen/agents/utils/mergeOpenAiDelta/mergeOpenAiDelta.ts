import { ChatCompletionChunk } from "@azure/openai/types";

/**
 * A stateful class that merges OpenAI chunk streams in an event-driven manner.
 * It accumulates messages and tool calls from the OpenAI API streaming responses.
 */
export class AzureOpenAiChunkMerger {
    /**
     * This variable contains the chunk history for debugging purposes.
     */
    private chunkHistory: ChatCompletionChunk[] = [];

    /**
     * This variable accumulates the messages and tool calls from the OpenAI API.
     * It is used to build a complete message as chunks are received.
     */
    private accumulatedMessage: ChatCompletionChunk[] = [];

    readChunk(chunk: ChatCompletionChunk): void {
        // If the chunk has no choices, skip it
        this.chunkHistory.push(chunk);
        this.processChunk(chunk);
    }

    private processChunk(chunk: ChatCompletionChunk): void {
        if (!chunk.choices || chunk.choices.length === 0) {
            return;
        }

        for (let [i, choice] of chunk.choices.entries()) {
            // we skip empty deltas
            if (!choice.delta) {
                continue;
            }
        }
    }
    
    /**
     * Get the number of chunks in the history
     * @returns The length of the chunk history array
     */
    getChunkHistoryLength(): number {
        return this.chunkHistory.length;
    }
    
    /**
     * Get a chunk at a specific index
     * @param index The index of the chunk to retrieve
     * @returns The chunk at the specified index
     */
    getChunkAt(index: number): ChatCompletionChunk {
        return this.chunkHistory[index];
    }
}