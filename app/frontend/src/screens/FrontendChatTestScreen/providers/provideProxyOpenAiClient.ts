import OpenAI from "openai";

export const provideProxyOpenAiClient = () => {
    const proxyBaseUrl = window.location.origin + '/api/2.0/ai';

    // Initialize the OpenAI client with the base URL and a dummy API key.
    const openai = new OpenAI({
        baseURL: proxyBaseUrl,          // The base URL is the proxy endpoint
        dangerouslyAllowBrowser: true,  // Nothing dangerous, the API key is not exposed.
        apiKey: 'dummy-key'             // The actual authentication is handled by the proxy
    });

    return openai;
}