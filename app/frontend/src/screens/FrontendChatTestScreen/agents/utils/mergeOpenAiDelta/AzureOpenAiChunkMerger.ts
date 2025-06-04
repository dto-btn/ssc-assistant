import { ChatCompletionChunk } from "@azure/openai/types";
import { ListenerManager } from "../../listenermanager/ListenerManager";
import type { AzureOpenAiChunkMerger as $ } from "./AzureOpenAiChunkMerger.types";
import { Listener } from "../../listenermanager/ListenerManager.types";

/**
 * A stateful class that merges OpenAI chunk streams in an event-driven manner.
 * It accumulates messages and tool calls from the OpenAI API streaming responses.
 */
export class AzureOpenAiChunkMerger {
    private _isFinished: boolean = false;

    /**
     * This variable contains the chunk history for debugging purposes.
     */
    private chunkHistory: ChatCompletionChunk[] = [];

    private listeners: ListenerManager<$.Events> = new ListenerManager();

    /**
     * This variable accumulates the messages and tool calls from the OpenAI API.
     * It is used to build a complete message as chunks are received.
     */
    private deltas: ChatCompletionChunk.Choice.Delta[] = [];

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

    getDeltas(): ChatCompletionChunk.Choice.Delta[] {
        return this.deltas;
    }

    getChunkHistory(): ChatCompletionChunk[] {
        return this.chunkHistory;
    }

    private processChoice(
        originChoice: ChatCompletionChunk.Choice
    ) {
        // we skip empty deltas
        if (!originChoice.delta) {
            console.error("Received empty choice in chunk. This should never happen.");
            return;
        }

        const choiceIndex = originChoice.index;
        let destinationDelta = this.deltas[choiceIndex];

        if (!destinationDelta) {
            // If the choice does not exist, create a new one
            this.deltas[choiceIndex] = { ...originChoice.delta };
            return;
        } else {
            // If the choice exists, we merge the delta into it
            this.mergeChoiceDelta(destinationDelta, originChoice.delta);
        }

        // If the choice is a text delta, we accumulate it
        if (destinationDelta.content) {
            this.listeners.notifyListeners({
                type: "streaming-text-accumulated",
                choiceIndex: choiceIndex,
                data: destinationDelta.content
            });
        }
    }

    
    private processChunk(chunk: ChatCompletionChunk): void {
        if (!chunk.choices || chunk.choices.length === 0) {
            return;
        }

        for (let [_, originChoice] of chunk.choices.entries()) {
            this.processChoice(originChoice);
        }
    }

    private mergeChoiceDelta(
        destination: ChatCompletionChunk.Choice.Delta,
        origin: ChatCompletionChunk.Choice.Delta
    ): void {
        if (origin.content) {
            // If the delta has content, we append it to the target
            destination.content = (destination.content || "") + origin.content;
        }
    }

}