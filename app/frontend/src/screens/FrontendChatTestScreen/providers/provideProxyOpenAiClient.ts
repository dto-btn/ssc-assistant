import {AzureOpenAI} from "openai";

type Options = {
    apiRootDomain?: string;
}

export const provideProxyOpenAiClient = (options: Options = {}) => {
    const defaultOptions: Options = {
        apiRootDomain: typeof window === 'undefined' ? '' : window.location.origin
    };
    options = { ...defaultOptions, ...options };

    const proxyBaseUrl = options.apiRootDomain + '/api/2.0/ai';

    // Initialize the OpenAI client with the base URL and a dummy API key.
    const openai = new AzureOpenAI({
        baseURL: proxyBaseUrl,          // The base URL is the proxy endpoint
        dangerouslyAllowBrowser: true,  // Nothing dangerous, the API key is not exposed.
        apiKey: 'dummy-key',             // The actual authentication is handled by the proxy
        apiVersion: 'dummy-api-version', // Specify the API version if needed
    });

    return openai;
}