import { useState } from 'react';
import { useOpenAiClient } from './hooks/useStreamingOpenAiClient'
import OpenAI from 'openai';
import { OpenAiClientNetworkStatus } from './hooks/useChat.types';

export const FrontendChatTestScreen = () => {
    const [status, setStatus] = useState<OpenAiClientNetworkStatus>('idle');
    const [streamIncomingText, setStreamIncomingText] = useState<string | null>(null);
    const [finalResponse, setFinalResponse] = useState<OpenAI.Chat.Completions.ChatCompletion | null>(null);

    const handleChatCompletionsCreate = async (...params: Parameters<OpenAI['chat']['completions']['create']>) => {
        if (status === 'idle' || status === 'error') {
            setStreamIncomingText(null); // Reset the streamIncomingText when starting a new request
            setFinalResponse(null); // Reset the final response when starting a new request
            chatCompletionsCreate(...params);
        }
    }

    const { chatCompletionsCreate } = useOpenAiClient({
        onNext: (chunk) => {
            console.log(chunk);
            if (chunk.choices[0]?.delta.content) {
                setStreamIncomingText((prev) => (prev || '') + chunk.choices[0].delta.content);
            }
        },
        onStatusChange: (status) => {
            setStatus(status);
            if (status === 'idle') {
                // Reset the streamIncomingText when the status is idle
                // setStreamIncomingText(null);
            }
        },
        onFinish: (response) => {
            setFinalResponse(response);
            // setStreamIncomingText(null); // Clear the stream text when finished
        },
    });
    return (
        <div>
            <h1>Frontend Chat Test Screen</h1>
            <p>Status: {status}</p>
            <button onClick={() => handleChatCompletionsCreate({
                model: 'gpt-4o',
                messages: [
                    { role: 'user', content: 'Write a long poem!' },
                ],
                stream: true,
            })}>Send Message</button>
            <div>
                <h2>Stream Incoming Text</h2>
                <p>{streamIncomingText}</p>
            </div>
            <div>
                <h2>Final Response</h2>
                {finalResponse ? (
                    <div>
                        <h3>Final Response:</h3>
                        <pre>{JSON.stringify(finalResponse, null, 2)}</pre>
                    </div>
                ) : (
                    <p>No final response yet.</p>
                )}
            </div>

        </div>
    )
}