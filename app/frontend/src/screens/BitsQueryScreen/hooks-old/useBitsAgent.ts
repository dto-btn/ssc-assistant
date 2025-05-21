import { useState, useCallback } from 'react';
import { useChat, Message } from './useChat';
import { BitsQueryParams, BitsQueryFilter } from '../types';
import { searchBits } from '../../../api/bits.api';

// Define agent tool types
interface ToolBase {
    type: string;
}

interface SetBitsStatusFiltersParams {
    statuses: string[];
}

interface SetBitsStatusFiltersTool extends ToolBase {
    type: 'setBitsStatusFilters';
    params: SetBitsStatusFiltersParams;
}

interface SetBitsFilterConditionsParams {
    filters: BitsQueryFilter[];
}

interface SetBitsFilterConditionsTool extends ToolBase {
    type: 'setBitsFilterConditions';
    params: SetBitsFilterConditionsParams;
}

interface SubmitQueryParams {
    limit?: number;
}

interface SubmitQueryTool extends ToolBase {
    type: 'submitQuery';
    params: SubmitQueryParams;
}

type AgentTool = SetBitsStatusFiltersTool | SetBitsFilterConditionsTool | SubmitQueryTool;

export interface UseBitsAgentResult {
    isLoading: boolean;
    currentStreamingMessage: string;
    sendMessage: (message: string) => Promise<void>;
    filters: BitsQueryFilter[];
    statuses: string[];
    limit: number;
    queryResults: any | null;
    queryMetadata: any | null;
    queryError: string | null;
    isQueryLoading: boolean;
    cancelStream: () => void;
    submitQueryResult: boolean;
    onSubmitQueryComplete: (success: boolean, error: string | null) => void;
    setQueryExecutionResults: (results: any, metadata: any) => void;
}

export function useBitsAgent(): UseBitsAgentResult {
    // Chat state from useChat hook
    const {
        isLoading,
        currentStreamingMessage,
        sendMessage: sendChatMessage,
        cancelStream
    } = useChat({
        systemPrompt: `You are a helpful assistant for the Business Information Technology Services (BITS) system. 
    You have access to three tools to help users search for business requests:
    1. setBitsStatusFilters - sets BITS Status filters in the frontend state
    2. setBitsFilterConditions - sets BITS filter conditions in the frontend state
    3. submitQuery - sends a query to BITS and waits for it to finish or fail
    
    When a user asks you to search for something, use these tools to formulate and execute queries.
    Think step by step about which filters would be appropriate based on the user's query.
    Always prefer to be specific with your filters rather than too broad.
    If you need to use multiple filters, set them all at once using setBitsFilterConditions.
    When you're confident in your filters, use submitQuery to execute the search.
    
    Explain your reasoning to the user at each step. Tell them what filters you're applying and why.`
    });

    // BITS query state
    const [filters, setFilters] = useState<BitsQueryFilter[]>([]);
    const [statuses, setStatuses] = useState<string[]>([]);
    const [limit, setLimit] = useState<number>(100);

    // Query results
    const [queryResults, setQueryResults] = useState<any | null>(null);
    const [queryMetadata, setQueryMetadata] = useState<any | null>(null);
    const [queryError, setQueryError] = useState<string | null>(null);
    const [isQueryLoading, setIsQueryLoading] = useState<boolean>(false);

    // Submit query state for tracking when external components should execute a query
    const [submitQueryResult, setSubmitQueryResult] = useState<boolean>(false);

    // Messages state for tracking conversation
    const [messages, setMessages] = useState<Message[]>([]);

    // Helper function to parse tool calls from assistant messages
    const parseToolCalls = (content: string): AgentTool[] => {
        const toolCalls: AgentTool[] = [];

        try {
            // Look for tool call patterns like: ```json\n{"type": "toolName", "params": {...}}\n```
            const regex = /```json\s*(\{[\s\S]*?\})\s*```/g;
            let match;

            while ((match = regex.exec(content)) !== null) {
                const toolCallJson = match[1];
                const toolCall = JSON.parse(toolCallJson);

                if (toolCall.type && (toolCall.params || toolCall.params === undefined)) {
                    toolCalls.push(toolCall as AgentTool);
                }
            }
        } catch (error) {
            console.error('Error parsing tool calls:', error);
        }

        return toolCalls;
    };

    // Execute the agent tools
    const executeTools = async (tools: AgentTool[]): Promise<string> => {
        let resultMessage = '';

        for (const tool of tools) {
            try {
                switch (tool.type) {
                    case 'setBitsStatusFilters':
                        setStatuses(tool.params.statuses || []);
                        resultMessage += `✅ Status filters updated: ${tool.params.statuses?.length || 0} statuses selected.\n`;
                        break;

                    case 'setBitsFilterConditions':
                        setFilters(tool.params.filters || []);
                        resultMessage += `✅ Filter conditions updated: ${tool.params.filters?.length || 0} conditions added.\n`;
                        break;

                    case 'submitQuery':
                        // Update limit if provided
                        if (tool.params.limit) {
                            setLimit(tool.params.limit);
                        }

                        // Signal to the form connection that a query should be executed
                        // and set loading state to provide better UI feedback
                        setSubmitQueryResult(true);
                        setIsQueryLoading(true);
                        resultMessage += '🔍 Executing BITS query...\n';
                        break;

                    default:
                        resultMessage += `⚠️ Unknown tool type: ${(tool as any).type}\n`;
                }
            } catch (error: any) {
                resultMessage += `❌ Error executing tool ${tool.type}: ${error.message}\n`;
            }
        }

        return resultMessage;
    };

    // Send a message and process any tool calls in the response
    const sendMessage = useCallback(async (userMessage: string): Promise<void> => {
        if (!userMessage.trim()) return;

        // Add user message to the state
        const newMessages: Message[] = [
            ...messages,
            { role: 'user' as const, content: userMessage }
        ];

        setMessages(newMessages);

        try {
            // Send message to the chat service
            const response = await sendChatMessage(newMessages);

            // Parse any tool calls from the response
            const toolCalls = parseToolCalls(response);

            // If there are tool calls, execute them
            let toolResults = '';
            if (toolCalls.length > 0) {
                toolResults = await executeTools(toolCalls);
            }

            // Add assistant message and any tool results to the state
            setMessages(prev => [
                ...prev,
                { role: 'assistant' as const, content: response },
                ...(toolResults ? [{ role: 'system' as const, content: toolResults }] : [])
            ]);

        } catch (error: any) {
            console.error('Error in sendMessage:', error);
            setMessages(prev => [
                ...prev,
                {
                    role: 'system' as const,
                    content: `Error: ${error.message || 'An unknown error occurred'}`
                }
            ]);
        }
    }, [messages, sendChatMessage, filters, statuses, limit]);

    // Handle direct query execution with results
    const setQueryExecutionResults = useCallback((results: any, metadata: any) => {
        setQueryResults(results);
        setQueryMetadata(metadata);
        setIsQueryLoading(false);
    }, []);

    // Handle query completion callback
    const onSubmitQueryComplete = useCallback((success: boolean, error: string | null) => {
        if (success) {
            setMessages(prev => [
                ...prev,
                { role: 'system' as const, content: '✅ Query executed successfully by the form.' }
            ]);
        } else {
            setQueryError(error);
            setMessages(prev => [
                ...prev,
                { role: 'system' as const, content: `❌ Query execution failed: ${error || 'Unknown error'}` }
            ]);
        }

        // Reset the submitQueryResult state and query loading state
        setSubmitQueryResult(false);
        setIsQueryLoading(false);
    }, []);

    return {
        isLoading,
        currentStreamingMessage,
        sendMessage,
        filters,
        statuses,
        limit,
        queryResults,
        queryMetadata,
        queryError,
        isQueryLoading,
        cancelStream,
        submitQueryResult,
        onSubmitQueryComplete,
        setQueryExecutionResults
    };
}
