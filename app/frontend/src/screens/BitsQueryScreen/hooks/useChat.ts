import { useState, useRef, useCallback, useEffect } from 'react';
import { OpenAI } from 'openai';

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

interface UseChatOptions {
    baseURL?: string;
    apiKey?: string;
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
}

export interface UseChatResult {
    isLoading: boolean;
    currentStreamingMessage: string;
    sendMessage: (messages: Message[]) => Promise<string>;
    cancelStream: () => void;
}

class ChatService {
    private openai: OpenAI;
    private isLoading = false;
    private currentStreamingMessage = '';
    private abortController: AbortController | null = null;
    private options: Required<UseChatOptions>;
    private listeners: { isLoading: ((val: boolean) => void)[], currentStreamingMessage: ((val: string) => void)[] } = {
        isLoading: [],
        currentStreamingMessage: []
    };

    constructor(options: UseChatOptions = {}) {
        const baseURL = window.location.origin + '/api/1.0/ai';

        this.options = {
            baseURL: baseURL,
            apiKey: options.apiKey || 'dummy', // The actual authentication is handled by the proxy
            model: options.model || 'gpt-4o',
            maxTokens: options.maxTokens || 500,
            systemPrompt: options.systemPrompt || 'You are a helpful AI assistant.'
        };
        this.openai = new OpenAI({
            baseURL: this.options.baseURL,
            dangerouslyAllowBrowser: true,
            apiKey: this.options.apiKey,
        });
    }

    private notify<K extends keyof typeof this.listeners>(key: K, value: Parameters<(typeof this.listeners)[K][0]>[0]) {
        this.listeners[key].forEach(cb => cb(value));
    }

    subscribe<K extends keyof typeof this.listeners>(key: K, cb: (val: Parameters<(typeof this.listeners)[K][0]>[0]) => void) {
        this.listeners[key].push(cb);
        // Initial call
        cb(this[key]);
        return () => {
            this.listeners[key] = this.listeners[key].filter(fn => fn !== cb);
        };
    }

    getIsLoading() {
        return this.isLoading;
    }
    getCurrentStreamingMessage() {
        return this.currentStreamingMessage;
    }

    async sendMessage(messages: Message[]): Promise<string> {
        if (this.isLoading) return '';
        this.isLoading = true;
        this.currentStreamingMessage = '';
        this.notify('isLoading', true);
        this.notify('currentStreamingMessage', '');
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();
        const apiMessages = [
            { role: 'system', content: this.options.systemPrompt },
            ...messages
        ];
        let fullContent = '';
        try {
            const stream = await this.openai.chat.completions.create({
                messages: apiMessages as any[],
                model: this.options.model,
                max_tokens: this.options.maxTokens,
                stream: true,
                signal: this.abortController.signal
            });
            for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullContent += content;
                this.currentStreamingMessage = fullContent;
                this.notify('currentStreamingMessage', fullContent);
            }
            if (!fullContent) {
                fullContent = "Sorry, I couldn't generate a response.";
            }
            return fullContent;
        } catch (error: any) {
            if (error?.name !== 'AbortError') {
                console.error('Error calling OpenAI proxy API:', error);
                if (error?.response?.data?.error?.message) {
                    console.error('API error message:', error.response.data.error.message);
                }
                return 'Sorry, there was an error processing your request. Please try again later.';
            }
            return '';
        } finally {
            this.isLoading = false;
            this.currentStreamingMessage = '';
            this.notify('isLoading', false);
            this.notify('currentStreamingMessage', '');
            this.abortController = null;
        }
    }

    cancelStream(): string {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
            this.isLoading = false;
            const interruptedMessage = this.currentStreamingMessage + ' [Response interrupted]';
            this.currentStreamingMessage = '';
            this.notify('isLoading', false);
            this.notify('currentStreamingMessage', '');
            return interruptedMessage;
        }
        return '';
    }
}

export function useChat(options: UseChatOptions = {}): UseChatResult {
    // Get environment-specific API URL if available or use the default
    const defaultOptions = {
        // baseURL: (window as any)?.ENV_CONFIG?.API_BASE_URL + '/ai',
        baseUrl: import.meta.env.BASE_URL + '/api/1.0/ai',
        ...options
    };

    const serviceRef = useRef<ChatService | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentStreamingMessage, setCurrentStreamingMessage] = useState<string>('');
    if (!serviceRef.current) {
        serviceRef.current = new ChatService(defaultOptions);
    }
    useEffect(() => {
        const service = serviceRef.current!;
        const unsubLoading = service.subscribe('isLoading', setIsLoading);
        const unsubMessage = service.subscribe('currentStreamingMessage', setCurrentStreamingMessage);
        return () => {
            unsubLoading();
            unsubMessage();
        };
    }, []);
    const sendMessage = useCallback(async (messages: Message[]): Promise<string> => {
        return await serviceRef.current!.sendMessage(messages);
    }, []);
    const cancelStream = useCallback(() => {
        return serviceRef.current?.cancelStream() || '';
    }, []);
    return {
        isLoading,
        currentStreamingMessage,
        sendMessage,
        cancelStream
    };
}