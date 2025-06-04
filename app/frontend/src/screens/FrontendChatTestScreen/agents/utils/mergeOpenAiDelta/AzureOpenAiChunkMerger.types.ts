import { ChatCompletionChunk } from "@azure/openai/types";

export namespace AzureOpenAiChunkMerger {
    export type Events = 
        | Events.MergeStarted
        | Events.StreamingTextAccumulated
        | Events.FinishedError
        | Events.FinishedOk;

    export namespace Events {

        /**
         * Indicates that the streaming process has started, and the first chunk is being processed.
         */
        export interface MergeStarted {
            type: "started";
        }

        /**
         * A streaming event that contains accumulated text message content from the assistant. This is helpful
         * for displaying the assistant's response in real-time as it is being generated.
         */
        export interface StreamingTextAccumulated {
            type: "incomingText";
            data: string;
        }

        export interface FinishedError {
            type: "finished:error";
            data: {
                error: unknown;
            }
        }

        export interface FinishedOk {
            type: "finished:ok";
            data: {
                history: ChatCompletionChunk[];
                accumulatedMessages: ChatCompletionChunk[];
                incomingText: string;
            }
        }
    }
}