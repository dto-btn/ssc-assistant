import OpenAI, { AzureOpenAI } from "openai";
import { TurnConnection } from "./TurnConnection";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { AgentToolRegistry } from "./AgentToolRegistry";
import { mapMemoryExportToOpenAIMessage } from "./AgentCoreMappers";
import { buildSystemPromptContent } from "./prompt-templates/systemPrompt.template";
import { evaluationPromptTemplate } from "./prompt-templates/evaluationPrompt.template";

export class AgentCore {
    private MAX_ITERATIONS = 10; // Maximum iterations to prevent infinite loops

    constructor(private openai: AzureOpenAI, private memory: AgentCoreMemory, private toolRegistry: AgentToolRegistry) {}

    /**
     * Process a query and return an AgentCoreConnection immediately.
     * The response will be populated asynchronously as processing completes.
     * 
     * @param query The query to process
     * @returns An AgentCoreConnection that will be populated with results
     */
    processQuery(query: string): TurnConnection {
        // Create a new AgentCoreConnection instance
        const cnx = new TurnConnection();
        
        // Start the processing in the background
        this.processQueryAsync(query, cnx);
        
        // Return the connection object immediately
        return cnx;
    }

    /**
     * Process a query asynchronously and populate the provided AgentCoreConnection.
     * 
     * @param query The query to process
     * @param cnx The TurnConnection for communicating results
     */
    private async processQueryAsync(query: string, cnx: TurnConnection): Promise<void> {
        // Limit for number of iterations, to prevent infinite loops.
        // Set it to max 10.
        let loopsRemaining = this.MAX_ITERATIONS;
        // Control variable for the autonomous loop
        let isTurnCompleted = false;

        const userTurnIdx = this.memory.addUserTurn(); // Add a user turn to the memory

        // Track conversation context
        const systemPrompt = buildSystemPromptContent(this.MAX_ITERATIONS, loopsRemaining);

        // Add the user message to the memory
        this.memory.addTurnAction(userTurnIdx, {
            type: 'action:user-message',
            content: query
        });

        // Create a single agent turn outside the loop
        const agentTurnIdx = this.memory.addAgentTurn();

        // Main autonomous reasoning loop should be limited to a certain number of iterations
        try {
            while (!isTurnCompleted && loopsRemaining > 0) {
                // decrease the loop counter to prevent infinite loops
                loopsRemaining--;
                try {
                    // Refresh memory messages before each API call to include previous iterations
                    const currentMemoryMessages = mapMemoryExportToOpenAIMessage(this.memory);
                    // Call OpenAI API with the current memory messages
                    const response = await this.openai.chat.completions.create({
                        model: "gpt-4o", // Use appropriate model
                        messages: [
                            systemPrompt,
                            ...currentMemoryMessages
                        ],
                        tools: this.buildToolSchema(),
                    });
                    
                    // Use the existing agent turn index, don't create a new one
                    const message = response.choices[0].message;

                    this.memory.addTurnAction(agentTurnIdx, {
                        type: 'action:agent-message',
                        content: message.content || '',
                    });
    
                    // Check if the AI wants to call a tool
                    if (message.tool_calls && message.tool_calls.length > 0) {
                        for (const toolCall of message.tool_calls) {
                            await this.handleToolCall(toolCall, agentTurnIdx);
                        }
                    } else if (message.content) {
                        // If the AI responded with content, this might be the final answer
                        // We'll use an LLM to evaluate whether this is the final response
                        // First, create a prompt to evaluate completion
                        const messages = mapMemoryExportToOpenAIMessage(this.memory);
                        try {
                            const isDone = await this.evaluateCompletionWithLLM(messages, cnx)
                            
                            if (isDone) {
                                // This appears to be a final answer after proper reasoning
                                
                                // Update progress to show we've completed
                                cnx.triggerEvent({
                                    type: 'finished',
                                    data: {
                                        finishReason: 'stop'
                                    }
                                });
                                isTurnCompleted = true;
                            }
                        } catch(error) {
                            console.error("Error evaluating completion:", error);
                            isTurnCompleted = true;
                            cnx.triggerEvent({
                                type: 'finished',
                                data: {
                                    finishReason: 'error'
                                }
                            });
                        };
                    }
                } catch (error) {
                    console.error("Error in autonomous loop:", error);
                    isTurnCompleted = true;
                    const finalResponse = "An error occurred while processing your request.";
    
                    cnx.triggerEvent({
                        type: 'error',
                        data: {
                            content: finalResponse
                        }
                    });
                    // cnx.triggerEvent({...progress});
                    // // Set the error response text and trigger error event
                    // cnx.setResponseText(finalResponse);
                    // cnx.triggerError(error);
                }
            }
        } catch (e) {
            console.error("Unexpected error during processing:", e);
            isTurnCompleted = true;
            cnx.triggerEvent({
                type: 'error',
                data: {
                    content: "An unexpected error occurred while processing your request."
                }
            });
            cnx.triggerEvent({
                type: 'finished',
                data: {
                    finishReason: 'error'
                }
            })
        } finally {
            cnx.setStatus('finished');
        }
        
        // If we've reached the iteration limit without completion
        if (!isTurnCompleted) {
            console.log("Maximum iterations reached. Extracting final response from conversation history.");
            // Update progress to show we've reached the maximum iterations
            // progress.currentIteration = this.MAX_ITERATIONS;
            cnx.triggerEvent({
                type: 'finished',
                data: {
                    finishReason: 'iterationLimitReached'
                }
            });
            // lastAction = 'max_iterations_reached';
            // cnx.triggerEvent({...progress});
            
            // // Extract the best possible response from conversation history
            // const extractedResponse = this.extractFinalResponseFromHistory(messages, progress);
            // cnx.setResponseText(extractedResponse);
            // cnx.triggerComplete();
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
        if (!this.toolRegistry.hasTool(functionName)) {
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

    private buildToolSchema() {
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

        const toolSchemas = this.toolRegistry.exportToolSchemas();
        // Merge inbuilt tools with registered tools
        const allToolSchemas = [...inbuiltToolSchemas, ...toolSchemas];

        return allToolSchemas;
    }
}