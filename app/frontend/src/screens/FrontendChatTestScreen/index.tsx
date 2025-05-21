import { useOpenAiClient } from './hooks/useStreamingOpenAiClient'

export const FrontendChatTestScreen = () => {
    const {
        status,
        chatCompletionsCreate,
        finalResponse,
        streamIncomingText,
    } = useOpenAiClient();
    return (
        <div>
            <h1>Frontend Chat Test Screen</h1>
            <p>Status: {status}</p>
            <button onClick={() => chatCompletionsCreate({
                model: 'gpt-4o',
                messages: [
                    { role: 'user', content: 'Hello!' },
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