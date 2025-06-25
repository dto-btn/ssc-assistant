import OpenAI, { AzureOpenAI } from "openai";
import { TurnConnection } from "./TurnConnection";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { AgentToolRegistry } from "./AgentToolRegistry";
import { mapMemoryExportToOpenAIMessage } from "./AgentCoreMappers";
import { buildSystemPromptContent } from "./prompt-templates/systemPrompt.template";
import { evaluationPromptTemplate } from "./prompt-templates/evaluationPrompt.template";
import { AgentCoreNonStreamingLlmClient } from "./AgentCoreLlmClientNonStreaming";
import { AgentCoreLlmClientStreaming } from "./AgentCoreLlmClientStreaming";
import { AgentCoreLlmClient } from "./AgentCoreLlmClient";
import { FinishReason } from "./AgentCoreEvent.types";
import { ProcessQueryOptions } from "./AgentCore.types";

/**
 * # AgentCore - The Brain of Our AI Assistant
 * 
 * ## What is AgentCore?
 * Think of AgentCore as the "brain" that powers our AI assistant. When you ask a question,
 * AgentCore doesn't just give you a quick response - it thinks step by step, uses tools
 * when needed, and keeps working until it has a complete answer for you.
 * 
 * ## How Does It Work? (The Simple Version)
 * 1. You ask a question
 * 2. AgentCore thinks about it and decides what to do
 * 3. It might use tools (like searching files, running code, etc.)
 * 4. It checks if the answer is complete
 * 5. If not complete, it goes back to step 2
 * 6. When done, it gives you the final answer
 * 
 * ## Real Examples
 * 
 * **Example 1: Simple Question**
 * - User: "What is 2+2?"
 * - Agent thinks: "This is basic math, I can answer directly"
 * - Agent responds: "2+2 equals 4"
 * - Agent checks: "Is this complete?" → Yes
 * - Result: Conversation finished
 * 
 * **Example 2: Complex Task**
 * - User: "Find all TypeScript files in the project and count the lines"
 * - Agent thinks: "I need to search for files and analyze them"
 * - Agent uses file_search tool to find .ts files
 * - Agent uses read_file tool to count lines in each file
 * - Agent thinks: "Now I have all the data, let me summarize"
 * - Agent responds: "Found 15 TypeScript files with 2,847 total lines"
 * - Agent checks: "Is this complete?" → Yes
 * - Result: Conversation finished
 * 
 * ## State Machine: The Agent's Journey
 * 
 * The agent moves through these states during processing:
 * 
 * ```
 * [STARTING] → [THINKING] → [USING_TOOLS] → [EVALUATING] → [FINISHED]
 *                  ↑            ↓              ↓
 *                  └────────────┴──────────────┘
 *                        (loops until done)
 * ```
 * 
 * **State Descriptions:**
 * 
 * - **STARTING**: Agent receives your question and prepares to work
 * - **THINKING**: Agent analyzes the situation and decides what to do next
 * - **USING_TOOLS**: Agent executes tools (file searches, code runs, etc.)
 * - **EVALUATING**: Agent checks if the task is complete or needs more work
 * - **FINISHED**: Agent has completed the task and provides final answer
 * 
 * **Special States:**
 * - **ERROR**: Something went wrong, agent stops and reports the issue
 * - **TIMEOUT**: Agent hit the maximum iteration limit (safety feature)
 * 
 * ## Technical Details
 * 
 * The autonomous reasoning loop works as follows:
 * 1. User query is stored in memory and a new conversation turn begins
 * 2. Loop runs up to MAX_ITERATIONS (10) times or until completion
 * 3. Each iteration:
 *    - Memory is converted to OpenAI message format
 *    - LLM is called with conversation history and available tools
 *    - Response is stored in memory
 *    - If response contains tool calls: execute each tool and store results
 *    - If response is text: evaluate if conversation is complete using second LLM
 *    - If complete: trigger 'finished' event
 *    - If error: trigger 'error' event and stop
 * 4. If max iterations reached: trigger 'iterationLimitReached' event
 * 
 * All state changes and events are communicated through the TurnConnection,
 * allowing the UI to show real-time progress and results.
 */
export class AgentCore {
    private MAX_ITERATIONS = 10; // Maximum iterations to prevent infinite loops
    private llmClientNonStreaming: AgentCoreLlmClient;
    private llmClientStreaming: AgentCoreLlmClient;

    constructor(
        private openai: AzureOpenAI, 
        private memory: AgentCoreMemory, 
        private toolRegistry: AgentToolRegistry
    ) {
        this.llmClientNonStreaming = new AgentCoreNonStreamingLlmClient(openai);
        this.llmClientStreaming = new AgentCoreLlmClientStreaming(openai);
    }

    /**
     * Process a query and return an AgentCoreConnection immediately.
     * The response will be populated asynchronously as processing completes.
     * 
     * @param query The query to process
     * @returns An AgentCoreConnection that will be populated with results
     */
    processQuery(query: string, options?: Partial<ProcessQueryOptions>): TurnConnection {
        // Create a new AgentCoreConnection instance
        const cnx = new TurnConnection();

        // Set default options
        const defaultOpts: ProcessQueryOptions = {
            useStreaming: false
        }
        const parsedOpts: ProcessQueryOptions = { ...defaultOpts, ...options };
        
        // Start the processing in the background
        this.processQueryAsync(query, cnx, parsedOpts);
        
        // Return the connection object immediately
        return cnx;
    }

    /**
     * Process a query asynchronously and populate the provided AgentCoreConnection.
     * 
     * @param query The query to process
     * @param turnCnx The TurnConnection for communicating results
     */
    private async processQueryAsync(query: string, turnCnx: TurnConnection, options: ProcessQueryOptions): Promise<void> {
        // initialize the MCP tools
        await this.toolRegistry.initializeMcpClients();

        // Create a state object to track iteration state
        const state = {
            isTurnCompleted: false,
            loopsRemaining: this.MAX_ITERATIONS
        };

        try {
            // Fetch MCP prompts and resources dynamically
            const mcpPrompts = await this.toolRegistry.getMcpPrompts();
            const mcpResources = await this.toolRegistry.getMcpResources();

            // Set up conversation context
            const userTurnIdx = this.memory.addUserTurn();
            
            // Build enhanced system prompt with MCP context
            const baseSystemPrompt = buildSystemPromptContent(this.MAX_ITERATIONS, state.loopsRemaining);
            const enhancedSystemPrompt = await this.enhanceSystemPromptWithMcpContext(baseSystemPrompt, mcpPrompts, mcpResources);
            
            // Add the user message to the memory
            this.memory.addTurnAction(userTurnIdx, {
                type: 'action:user-message',
                content: query
            });

            const agentTurnIdx = this.memory.addAgentTurn();

            // Main processing loop
            while (!state.isTurnCompleted && state.loopsRemaining > 0) {
                state.loopsRemaining--;
                
                try {
                    const currentMemoryMessages = mapMemoryExportToOpenAIMessage(this.memory);

                    // This will change in streaming mode, but for now we use the non-streaming client
                    const response = await this.getLLMResponse(turnCnx, enhancedSystemPrompt, currentMemoryMessages, options);
                    
                    if (response.tool_calls && response.tool_calls.length > 0) {
                        await this.processToolCalls(response.tool_calls, agentTurnIdx);
                    } else if (response.content) {
                        await this.processContentResponse(response.content, agentTurnIdx, state, turnCnx);
                    }
                } catch (error) {
                    console.error("Error in autonomous loop:", error);
                    state.isTurnCompleted = true;
                    this.emitErrorEvent(turnCnx, "An error occurred while processing your request.");
                }
            }
        } catch (e) {
            console.error("Unexpected error during processing:", e);
            this.emitErrorEvent(turnCnx, "An unexpected error occurred while processing your request.");
            this.emitFinishedEvent(turnCnx, 'error');
        } finally {
            turnCnx.setStatus('finished');
        }
        
        if (!state.isTurnCompleted) {
            console.log("Maximum iterations reached. Extracting final response from conversation history.");
            this.emitFinishedEvent(turnCnx, 'iterationLimitReached');
        }
    }

    /**
     * Evaluates whether the conversation has reached a natural conclusion by using an LLM
     * to analyze the entire conversation history.
     * 
     * @param messages The complete conversation history
     * @param cnx The TurnConnection for communicating events
     * @returns A promise that resolves to a boolean indicating if the conversation is complete
     */
    private async evaluateCompletionWithLLM(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        cnx: TurnConnection
    ): Promise<boolean> {
        // Create a system prompt that asks the LLM to evaluate if the conversation is complete
        const evaluationPrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            evaluationPromptTemplate()
        ];
        
        // Add a simplified version of the conversation history
        // Convert the messages to a readable format for the evaluation LLM
        const simplifiedHistory = messages.map(msg => {
            if (msg.role === 'system') {
                return `[System Instructions]`;
            } else if (msg.role === 'user') {
                return `User: ${msg.content}`;
            } else if (msg.role === 'assistant') {
                if (msg.content) {
                    return `Agent: ${msg.content}`;
                } else if (msg.tool_calls) {
                    return `Agent: [Used tool: ${msg.tool_calls.map(t => t.function.name).join(', ')}]`;
                }
                return 'Agent: [No content]';
            } else if (msg.role === 'tool') {
                return `Tool Result: ${msg.content}`;
            }
            return `${msg.role}: ${JSON.stringify(msg)}`;
        }).join('\n\n');
        
        evaluationPrompt.push({
            role: 'user',
            content: `Here is the conversation history:\n\n${simplifiedHistory}\n\nIs this conversation complete? Answer with ONLY 'true' or 'false'.`
        });
        
        // Log the evaluation process
        cnx.triggerEvent({
            type: 'debug-log',
            data: {
                logLevel: 'debug',
                logContent: 'Evaluating conversation completion with LLM'
            }
        });
        
        try {
            // Call the LLM to evaluate if the conversation is complete
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o", // Use the same model for consistency
                messages: evaluationPrompt,
                temperature: 0.1, // Low temperature for more deterministic responses
                max_tokens: 10, // Only need a short response (true/false)
            });

            
            const evaluationResult = response.choices[0].message.content || '';
            const isDone = evaluationResult.trim().toLowerCase() === 'true';
            
            console.log("[DEBUG] Evaluation result:", evaluationResult, "Is done:", isDone);
            
            // Log the evaluation result
            cnx.triggerEvent({
                type: 'debug-log',
                data: {
                    logLevel: 'info',
                    logContent: `Completion evaluation result: ${evaluationResult} (isDone: ${isDone})`
                }
            });
            
            return isDone;
        } catch (error) {
            console.error("Error during completion evaluation:", error);
            cnx.triggerEvent({
                type: 'debug-log',
                data: {
                    logLevel: 'error',
                    logContent: `Error during completion evaluation: ${error}`
                }
            });
            
            // Re-throw to be handled by the caller
            throw error;
        }
    }

    /**
     * Handles a single tool call, including error handling and memory updates.
     * @param toolCall The tool call object from OpenAI response
     * @param agentTurnIdx The current agent turn index
     */
    private async handleToolCall(toolCall: any, agentTurnIdx: number): Promise<void> {
        // If the tool call is not a function, we log an error and continue
        if (toolCall.type !== 'function') {
            const msg = `Tool call type "${toolCall.type}" is not supported. Please ensure the tool call is a function.`;
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-error',
                content: msg
            });
            console.error(msg);
            return;
        }
        const functionName = toolCall.function.name;
        let functionArgs: any = {};
        try {
            debugger
            functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (e) {
            const msg = `Failed to parse arguments for function \"${functionName}\": ${e}`;
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-error',
                content: msg
            });
            console.error(msg);
            return;
        }
        // Handle internal function calls (think, observe)
        if (functionName === 'think') {
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-thought',
                content: functionArgs.reasoning
            });
            return;
        }
        if (functionName === 'observe') {
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-observation',
                content: functionArgs.observation
            });
            return;
        }
        // Now we know this is not an internal function call, so we can proceed with normal tool call handling
        this.memory.addTurnAction(agentTurnIdx, {
            type: 'action:agent-tool-call',
            toolArguments: toolCall.function.arguments,
            toolCallId: toolCall.id,
            toolName: toolCall.function.name
        });
        
        // Check if tool exists (including MCP tools)
        const hasLocalTool = this.toolRegistry.hasTool(functionName);
        const hasMcpTool = !hasLocalTool ? await this.toolRegistry.hasToolAsync(functionName) : false;
        
        if (!hasLocalTool && !hasMcpTool) {
            // If the tool is not registered, we log an error and continue
            const msg = `Function \"${functionName}\" not found. Please ensure the function is defined in the tool handlers.`;
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-tool-call-response',
                toolCallId: toolCall.id,
                toolName: functionName,
                toolResponse: JSON.stringify({ error: msg })
            });
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-error',
                content: msg
            });
            console.error(msg);
            return;
        }
        // Tool call is valid, proceed to use the tool
        try {
            const result = await this.toolRegistry.useTool(functionName, functionArgs);
            // If the tool call was successful, we log the response
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-tool-call-response',
                toolCallId: toolCall.id,
                toolName: functionName,
                toolResponse: JSON.stringify(result)
            });
            console.log(`Tool call \"${functionName}\" succeeded with response:`, result);
        } catch (error) {
            const msg = `Error calling tool \"${functionName}\": ${error instanceof Error ? error.message : JSON.stringify(error)}`;
            console.error(msg);
            // If the tool call fails, we log it and continue
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-tool-call-response',
                toolCallId: toolCall.id,
                toolName: functionName,
                toolResponse: JSON.stringify({ error: msg })
            });
            this.memory.addTurnAction(agentTurnIdx, {
                type: 'action:agent-error',
                content: msg
            });
        }
    }

    /**
     * Gets a response from the LLM with the current conversation history
     */
    private async getLLMResponse(
        turnCnx: TurnConnection,
        systemPrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam,
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        options: ProcessQueryOptions
    ): Promise<OpenAI.Chat.Completions.ChatCompletionMessage> {
        return new Promise(async (resolve, reject) => {
            try {
                // Choose the appropriate client based on the streaming flag
                const llmClient = options.useStreaming ? this.llmClientStreaming : this.llmClientNonStreaming;
                
                // Track if we've already resolved or rejected this promise
                let isSettled = false;
                
                // Build tool schema (including MCP tools)
                const toolSchema = await this.buildToolSchema();
                
                const chatCompletionCnx = llmClient.createChatCompletion({
                    model: "gpt-4o",
                    messages: [
                        systemPrompt,
                        ...messages
                    ],
                    tools: toolSchema,
                });
            
                // For streaming, we need to handle partial updates
                let accumulatedContent = '';
                
                chatCompletionCnx.onEvent((evt) => {
                    try {
                        switch (evt.type) {
                            case 'streaming-message-update':
                                // Update the content as it streams in.
                                // This only happens in streaming mode.
                                if (evt.data && evt.data.content !== undefined) {
                                    accumulatedContent = evt.data.content || '';
                                    this.emitStreamingMessageUpdateEvent(turnCnx, accumulatedContent);
                                }
                                break;
                            case 'message':
                                // This is the final message with all data
                                if (!isSettled) {
                                    isSettled = true;
                                    if (evt.data && evt.data.content !== undefined) {
                                        accumulatedContent = evt.data.content || '';
                                    }
                                    resolve(evt.data);
                                }
                                break;
                            case 'close':
                                // Handle connection close
                                if (!evt.data.ok && !isSettled) {
                                    // If the connection closed with an error and we haven't settled yet, reject the promise
                                    isSettled = true;
                                    reject(new Error(`Connection closed with error: ${evt.data.error}`));
                                }
                                break;
                        }
                    } catch (eventError) {
                        console.error("Error handling event:", eventError);
                        if (!isSettled) {
                            isSettled = true;
                            reject(eventError);
                        }
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Processes all tool calls in the LLM response
     */
    private async processToolCalls(toolCalls: any[], agentTurnIdx: number): Promise<void> {
        for (const toolCall of toolCalls) {
            await this.handleToolCall(toolCall, agentTurnIdx);
        }
    }

    /**
     * Processes a content response from the LLM
     */
    private async processContentResponse(
        content: string,
        agentTurnIdx: number,
        state: { isTurnCompleted: boolean },
        turnCnx: TurnConnection
    ): Promise<void> {
        this.memory.addTurnAction(agentTurnIdx, {
            type: 'action:agent-message',
            content: content,
        });
        
        try {
            // Evaluate if the conversation is complete
            const messages = mapMemoryExportToOpenAIMessage(this.memory);
            const isDone = await this.evaluateCompletionWithLLM(messages, turnCnx);
            
            if (isDone) {
                this.emitFinishedEvent(turnCnx, 'stop');
                state.isTurnCompleted = true;
            }
        } catch (error) {
            console.error("Error evaluating completion:", error);
            state.isTurnCompleted = true;
            this.emitFinishedEvent(turnCnx, 'error');
        }
    }

    /**
     * Emit an error event to the TurnConnection
     */
    private emitErrorEvent(turnCnx: TurnConnection, message: string): void {
        turnCnx.triggerEvent({
            type: 'error',
            data: { content: message }
        });
    }

    /**
     * Emit a finished event to the TurnConnection
     */
    private emitFinishedEvent(turnCnx: TurnConnection, reason: FinishReason): void {
        turnCnx.triggerEvent({
            type: 'finished',
            data: { finishReason: reason }
        });
    }

    private emitStreamingMessageUpdateEvent(turnCnx: TurnConnection, content: string): void {
        turnCnx.triggerEvent({
            type: 'streaming-message-update',
            data: { content }
        });
    }

    private async buildToolSchema(): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
        // Define available tools for the inbuilt tools
        const inbuiltToolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: 'think',
                    description: 'Use this function to explicitly reason through your thoughts. This is the first step in the ReAct process.',
                    parameters: {
                        type: 'object',
                        properties: {
                            reasoning: { type: 'string', description: 'Your step-by-step reasoning about the current situation' }
                        },
                        required: ['reasoning']
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'observe',
                    description: 'Use this function to summarize what you have learned and observed so far. This is a crucial step in the ReAct process.',
                    parameters: {
                        type: 'object',
                        properties: {
                            observation: { type: 'string', description: 'Your summary of what you have learned so far' }
                        },
                        required: ['observation']
                    }
                }
            }
        ];

        // Get tool schemas including MCP tools
        const registryToolSchemas = await this.toolRegistry.exportToolSchemasAsync();
        
        // Merge inbuilt tools with registered tools (including MCP tools)
        const allToolSchemas = [...inbuiltToolSchemas, ...registryToolSchemas];

        return allToolSchemas;
    }

    /**
     * Enhances the system prompt with MCP prompts and resources context
     */
    private async enhanceSystemPromptWithMcpContext(
        basePrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam,
        mcpPrompts: any[],
        mcpResources: any[]
    ): Promise<OpenAI.Chat.Completions.ChatCompletionMessageParam> {
        let enhancedContent = basePrompt.content as string;

        // Add MCP tools context
        try {
            const mcpTools = await this.toolRegistry.getMcpTools();
            if (mcpTools.length > 0) {
                const toolsContext = mcpTools.map(tool => 
                    `- ${tool.name}: ${tool.description || 'No description available'}`
                ).join('\n');
                
                enhancedContent += `\n\n## Available MCP Tools\nYou have access to the following tools from MCP servers:\n${toolsContext}`;
            }
        } catch (error) {
            console.error('Error fetching MCP tools for system prompt:', error);
        }

        // Add MCP prompts context
        if (mcpPrompts.length > 0) {
            const promptsContext = mcpPrompts.map(prompt => 
                `- ${prompt.name}: ${prompt.description || 'No description available'}`
            ).join('\n');
            
            enhancedContent += `\n\n## Available MCP Prompts\nYou have access to the following prompts that can help structure your responses:\n${promptsContext}`;
        }

        // Add MCP resources context
        if (mcpResources.length > 0) {
            const resourcesContext = mcpResources.map(resource => 
                `- ${resource.uri}: ${resource.description || resource.name || 'Resource available'}`
            ).join('\n');
            
            enhancedContent += `\n\n## Available MCP Resources\nYou have access to the following resources for additional context:\n${resourcesContext}`;
        }

        return {
            ...basePrompt,
            content: enhancedContent
        };
    }
}