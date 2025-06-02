import OpenAI, { AzureOpenAI } from "openai";
import { TurnConnection } from "./TurnConnection";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { AgentToolCall } from "./AgentCoreMemory.types";

const mapMemoryExportToOpenAIMessage = (memory: AgentCoreMemory): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
    const turns = memory.export();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const turn of turns) {
        if (turn.type === 'turn:user') {
            for (const action of turn.actions) {
                switch (action.type) {
                    case 'action:user-message':
                        messages.push({
                            role: 'user',
                            content: action.content
                        });
                        break;
                    default:
                        throw new Error(`Unknown user action type: ${action.type}`);
                }
            }
        } else if (turn.type === 'turn:agent') {
            let currentToolCalls: AgentToolCall[] | undefined = undefined;

            for (const action of turn.actions) {
                // If we have tool calls and the next action is not a tool call, we need to flush them
                if (currentToolCalls !== undefined && action.type !== 'action:agent-tool-call') {
                    messages.push({
                        role: 'assistant',
                        tool_calls: currentToolCalls.map(toolCall => ({
                            id: toolCall.toolCallId,
                            type: 'function',
                            function: {
                                name: toolCall.toolName,
                                arguments: toolCall.toolArguments
                            }
                        }))
                    });
                    currentToolCalls = undefined; // Reset tool calls after flushing   
                }

                
                switch (action.type) {
                    case 'action:agent-message':
                        messages.push({
                            role: 'assistant',
                            content: action.content
                        });
                        break;
                    case 'action:agent-thought':
                        messages.push({
                            role: 'assistant',
                            content: `Thought: ${action.content}`
                        });
                        break;
                    case 'action:agent-observation':
                        messages.push({
                            role: 'assistant',
                            content: `Observation: ${action.content}`
                        });
                        break;
                    case 'action:agent-tool-call':
                        // Tool calls in OpenAI appear inside assistant messages as an array.
                        // However, we add separate messages for each tool call in our memory.
                        // So we need to collect them until we hit a non-tool call action.
                        if (!currentToolCalls) {
                            currentToolCalls = [];
                        }
                        currentToolCalls.push(action);
                        break;
                    case 'action:agent-tool-call-response':
                        messages.push({
                            role: 'tool',
                            tool_call_id: action.toolCallId,
                            content: action.toolResponse
                        });
                        break;
                    case 'action:agent-error':
                        messages.push({
                            role: 'assistant',
                            content: `Error: ${action.content}`
                        });
                        break;
                    default:
                        throw new Error(`Unknown agent action type: ${action.type}`);
                }
            }
        } else {
            throw new Error(`Unknown turn type`, turn);
        }
    }

    return messages;
}

export class AgentCore {
    private MAX_ITERATIONS = 10; // Maximum iterations to prevent infinite loops

    constructor(private openai: AzureOpenAI, private memory: AgentCoreMemory) {}

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
        const systemPrompt: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
                role: 'system',
                content: `
The current local time is ${new Date().toISOString()}.

You are a ReAct (Reasoning and Acting) agent that follows a specific process:
1. THINK: First, think about what you know and what you need to find out
2. OBSERVE: Review your thoughts and form conclusions

Follow this process for your reasoning:
- Use the 'think' tool to explicitly reason through your thoughts
- Use the 'observe' tool to summarize what you've learned

After you've completed your reasoning process, respond directly to the user with your final answer.
No need to call a special function - just provide your answer in a clear, concise way.

You have a maximum of ${this.MAX_ITERATIONS} iterations to complete your reasoning. Currently, you have ${loopsRemaining} out of ${this.MAX_ITERATIONS} iterations remaining.
                `
        };

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
                    
                    const messages = [
                        systemPrompt,
                        ...currentMemoryMessages
                    ]
                    
                    // We don't need to add userMessage separately since it's already in memory
                    // and included in currentMemoryMessages

                    // Call the OpenAI API
                    const response = await this.openai.chat.completions.create({
                        model: "gpt-4o", // Use appropriate model
                        messages,
                        tools: inbuiltToolSchemas,
                    });
                    
                    // Use the existing agent turn index, don't create a new one
                    const message = response.choices[0].message;
                    this.memory.addTurnAction(agentTurnIdx, {
                        type: 'action:agent-message',
                        content: message.content || '',
                    });
    
                    // debug console log
                    console.log("[DEBUG] AI response:", message);
    
                    // Check if the AI wants to call a tool
                    if (message.tool_calls && message.tool_calls.length > 0) {
                        for (const toolCall of message.tool_calls) {
                            if (toolCall.type === 'function') {
                                // deal with the tool call
                                const functionName = toolCall.function.name;
                                const functionArgs = JSON.parse(toolCall.function.arguments);
                                
                                console.log(`Function called: ${functionName}`);
                                
                                // Handle think or observe functions
                                if (functionName === 'think' || functionName === 'observe') {
                                    // Execute the function
                                    switch(functionName) {
                                        case 'think':
                                            this.memory.addTurnAction(agentTurnIdx, {
                                                type: 'action:agent-thought',
                                                content: functionArgs.reasoning
                                            });
                                            break;

                                        case 'observe':
                                            this.memory.addTurnAction(agentTurnIdx, {
                                                type: 'action:agent-observation',
                                                content: functionArgs.observation
                                            });
                                            break;
                                        default:
                                            this.memory.addTurnAction(agentTurnIdx, {
                                                type: 'action:agent-error',
                                                content: `Unknown function "${functionName}" called. Please ensure the function is defined in the tool handlers.`
                                            });
                                            console.error(`Unknown function "${functionName}" called. Please ensure the function is defined in the tool handlers.`);
                                            continue; // Skip to the next tool call
                                    }
                                } else {
                                    // add the tool call to the memory
                                    this.memory.addTurnAction(agentTurnIdx, {
                                        type: 'action:agent-tool-call',
                                        toolArguments: toolCall.function.arguments,
                                        toolCallId: toolCall.id,
                                        toolName: toolCall.function.name
                                    })

                                    this.memory.addTurnAction(agentTurnIdx, {
                                        type: 'action:agent-tool-call-response',
                                        toolCallId: toolCall.id,
                                        toolName: functionName,
                                        toolResponse: JSON.stringify({ error: "Function not found" })
                                    });

                                    this.memory.addTurnAction(agentTurnIdx, {
                                        type: 'action:agent-error',
                                        content: `Function "${functionName}" not found. Please ensure the function is defined in the tool handlers.`
                                    });
                                }
                            }
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
            {
                role: 'system',
                content: `
You are an evaluator determining if a ReAct agent's conversation has reached a natural conclusion.

You will analyze the entire history of a conversation and determine if the agent has provided a final answer to the user's query.

A complete conversation MUST have the following:
- A final response from the agent that directly and comprehensively answers the user's original query
- OR, a question for the user that indicates a need for more information, clarification, or input to proceed.

Specifically, if the agent's last message is asking the user for more details, clarification, or any form of input, ALWAYS mark the conversation as complete.

Examples of agent questions that should be considered complete:
- "Could you please provide more details about the specific plan you would like me to execute?"
- "Can you clarify what you mean by X?"
- "I need more information to help you with that. Could you explain...?"
- "What specific aspects of X are you interested in?"

Do NOT consider a conversation complete if:
- The agent has stated or clearly implied that it will continue reasoning or acting independently.

Analyze the following conversation and determine if it has reached a natural conclusion.
Is it complete? Why or why not?
                `
            }
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
}