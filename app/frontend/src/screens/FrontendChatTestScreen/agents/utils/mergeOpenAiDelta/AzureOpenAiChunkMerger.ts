import { ChatCompletionChunk, ChatCompletion } from "@azure/openai/types";
import { ListenerManager } from "../../listenermanager/ListenerManager";
import type { AzureOpenAiChunkMerger as $ } from "./AzureOpenAiChunkMerger.types";
import { Listener } from "../../listenermanager/ListenerManager.types";

/**
 * A stateful class that merges OpenAI chunk streams in an event-driven manner.
 * It accumulates messages and tool calls from the OpenAI API streaming responses.
 */
export class AzureOpenAiChunkMerger {
    /**
     * This variable contains the chunk history for debugging purposes.
     */
    private chunkHistory: ChatCompletionChunk[] = [];

    private listeners: ListenerManager<$.Events> = new ListenerManager();

    /**
     * This variable accumulates the messages and tool calls from the OpenAI API.
     * It is used to build a complete message as chunks are received.
     */
    private choices: ChatCompletionChunk.Choice.Delta[] = [];
    

    constructor() {
    }

    readChunk(chunk: ChatCompletionChunk): void {
        this.listeners.notifyListeners({ type: "all-started" });
        this.chunkHistory.push(chunk);
        this.processChunk(chunk);
    }

    onEvent(listener: Listener<$.Events>): () => void {
        this.listeners.addListener(listener);
        return () => {
            this.listeners.removeListener(listener);
        }
    }

    private processChunk(chunk: ChatCompletionChunk): void {
        if (!chunk.choices || chunk.choices.length === 0) {
            return;
        }

        for (let [i, choice] of chunk.choices.entries()) {
            // we skip empty deltas
            if (!choice.delta) {
                console.error("Received empty choice in chunk. This should never happen.", chunk);
                continue;
            }

            const choiceIndex = choice.index;

            let target = this.choices[choiceIndex];

            if (!target) {
                // If the choice does not exist, create a new one
                this.choices[choiceIndex] = choice.delta;
                continue;
            }

            // If the choice exists, we merge the delta into it
            this.mergeChoiceDelta(target, choice.delta);

            // If the choice is a text delta, we accumulate it
            if (choice.delta.content) {
                this.listeners.notifyListeners({
                    type: "incomingText",
                    choiceIndex: choiceIndex,
                    data: choice.delta.content
                });
            }
        }
    }

    private mergeChoiceDelta(
        target: ChatCompletionChunk.Choice.Delta,
        delta: ChatCompletionChunk.Choice.Delta
    ): void {

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