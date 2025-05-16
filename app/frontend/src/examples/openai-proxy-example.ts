// Example of using the OpenAI SDK with our custom proxy endpoint
import OpenAI from 'openai';

// Create a custom OpenAI client that points to our proxy
export const createProxyOpenAIClient = () => {
    // Get the base URL for the API (adjust based on your environment)
    const baseURL = 'http://localhost:5001/api/1.0/ai';

    // Create the OpenAI client with custom baseURL
    const openai = new OpenAI({
        baseURL,
        apiKey: 'dummy',  // The actual authentication is handled by the proxy
        dangerouslyAllowBrowser: true, // Only use this for client-side code
    });

    return openai;
};

// Example usage:
export const generateCompletion = async (messages: any[]) => {
    try {
        const openai = createProxyOpenAIClient();

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o', // This could be configured in environment
            messages,
            max_tokens: 500,
            temperature: 0.7,
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error('Error generating completion:', error);
        throw error;
    }
};

// Example of using streaming:
export const generateStreamingCompletion = async (
    messages: any[],
    onChunk: (chunk: string) => void,
    onComplete: () => void
) => {
    try {
        const openai = createProxyOpenAIClient();

        const stream = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            stream: true,
            max_tokens: 500,
        });

        let fullResponse = '';

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                fullResponse += content;
                onChunk(content);
            }
        }

        onComplete();
        return fullResponse;
    } catch (error) {
        console.error('Error generating streaming completion:', error);
        throw error;
    }
};

// Example messages
const exampleMessages = [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    { role: 'user', content: 'Tell me about Shared Services Canada.' }
];

// Usage examples (uncomment to test)
generateCompletion(exampleMessages).then(console.log);
generateStreamingCompletion(
    exampleMessages,
    (chunk) => console.log('Chunk:', chunk),
    () => console.log('Stream complete!')
);
