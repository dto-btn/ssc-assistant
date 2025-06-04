import { ChatCompletionChunk } from "@azure/openai/types";

export namespace AzureOpenAiChunkMerger {
    export type Events = 
        | Events.MergeStarted
        | Events.StreamingTextAccumulated
        | Events.AllFinishedError
        | Events.AllFinishedOk;

    export namespace Events {

        /**
         * Indicates that the streaming process has started, and the first chunk is being processed.
         */
        export interface MergeStarted {
            type: "all-started";
        }

        /**
         * A streaming event that contains accumulated text message content from the assistant. This is helpful
         * for displaying the assistant's response in real-time as it is being generated.
         */
        export interface StreamingTextAccumulated {
            type: "incomingText";
            data: string;
            choiceIndex: number;
        }

        export interface AllFinishedError {
            type: "all-finished:error";
            data: {
                error: unknown;
            }
        }

        export interface AllFinishedOk {
            type: "all-finished:ok";
            data: {
                chunks: ChatCompletionChunk[];
                choices: ChatCompletionChunk.Choice.Delta[];
            }
        }
    }
}