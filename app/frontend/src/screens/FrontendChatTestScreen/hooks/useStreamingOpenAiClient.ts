import { useMemo, useRef, useState } from "react"
import { OpenAiClientNetworkStatus } from "./useChat.types"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import OpenAI from "openai";
import type { Stream } from "openai/streaming.mjs";
import { mergeOpenAIChunks } from "../utils/mergeOpenAiChunks";

/**
 * A custom hook that manages streaming state for the current OpenAI client.
 */
export const useOpenAiClient = () => {
    const [status, setStatus] = useState<OpenAiClientNetworkStatus>('idle');
    const [streamIncomingText, setStreamIncomingText] = useState<string | null>(null);
    const [finalResponse, setFinalResponse] = useState<OpenAI.Chat.Completions.ChatCompletion | null>(null);
    const streamRawChunks = useRef<OpenAI.Chat.Completions.ChatCompletionChunk[] | null>(null);

    const chatCompletionsCreate = async (...params: Parameters<OpenAI['chat']['completions']['create']>) => {
        const client = provideProxyOpenAiClient();
        const [firstParam, ...rest] = params;

        if (firstParam.stream) {
            setStatus('streaming');
            let streamingResponse: Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
            try {
                streamingResponse = await client.chat.completions.create(...params) as Stream<OpenAI.Chat.Completions.ChatCompletionChunk>;
                for await (const chunk of streamingResponse) {
                    if (chunk.choices[0]?.delta.content) {
                        if (!streamRawChunks.current) {
                            // Initialize streamRawChunks if it is null
                            streamRawChunks.current = [];
                        }
                        streamRawChunks.current.push(chunk);
                        setStreamIncomingText((prev) => (prev || '') + chunk.choices[0].delta.content);
                    }
                }

                // finally, deep-merge the chunks into a single object
                if (streamRawChunks.current === null) {
                    console.error('StreamRawChunks.current is null. This should not happen.');
                    setStatus('error');
                    return;
                }
                setFinalResponse(mergeOpenAIChunks(streamRawChunks.current));
                setStreamIncomingText(null);
                setStatus('idle');
                streamRawChunks.current = null; // Reset the streamRawChunks after processing
            } catch (e) {
                setStatus('error');
                console.error('Error creating streaming response:', e);
                return;
            }
        } else {
            let nonStreamingResponse: OpenAI.Chat.Completions.ChatCompletion;
            try {
                nonStreamingResponse = await client.chat.completions.create(...params) as OpenAI.Chat.Completions.ChatCompletion;
            } catch (e) {
                setStatus('error');
                console.error('Error creating non-streaming response:', e);
                return;
            }
        }
    }

    return {
        status,
        chatCompletionsCreate,
        finalResponse,
        streamIncomingText
    }    
}