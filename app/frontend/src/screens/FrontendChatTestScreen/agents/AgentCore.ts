import OpenAI, { AzureOpenAI } from "openai";
import { AgentCoreConnection, AgentProgressData } from "./AgentCoreResponse";

export class AgentCore {
    private MAX_ITERATIONS = 10; // Maximum iterations to prevent infinite loops

    constructor(private openai: AzureOpenAI) {}

    /**
     * Process a query and return an AgentCoreResponse immediately.
     * The response will be populated asynchronously as processing completes.
     * 
     * @param query The query to process
     * @returns An AgentCoreResponse that will be populated with results
     */
    processQuery(query: string): AgentCoreConnection {
        // Create a new AgentCoreResponse instance
        const cnx = new AgentCoreConnection();
        
        // Start the processing in the background
        this.processQueryAsync(query, cnx);
        
        // Return the response object immediately
        return cnx;
    }

    /**
     * Process a query asynchronously and populate the provided AgentCoreResponse.
     * 
     * @param query The query to process
     * @param agentResponse The AgentCoreResponse to populate with results
     */
    private async processQueryAsync(query: string, agentResponse: AgentCoreConnection): Promise<void> {
        // Limit for number of iterations, to prevent infinite loops.
        // Set it to max 10.
        let loopsRemaining = this.MAX_ITERATIONS;
        // Control variable for the autonomous loop
        let isTurnCompleted = false;
        // Store the final response to return to the user
        let finalResponse: string = '';
        
        // Track ReAct progress
        const progress: AgentProgressData = {
            currentIteration: 0,
            maxIterations: this.MAX_ITERATIONS,
            hasThought: false,
            hasObserved: false,
            uniqueToolCalls: new Set<string>(),
            reasoningSteps: 0,
        };

        // Track conversation context
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
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
            },
            { role: 'user', content: query }
        ];

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

        // Implement the tool handlers for the inbuilt tools
        const inbuiltToolHandlers: Record<string, Function> = {
            think: async (args: { reasoning: string }) => {
                // Update progress tracking
                progress.hasThought = true;
                progress.reasoningSteps++;
                progress.lastAction = 'think';
                progress.lastActionContent = args.reasoning;
                
                // Send progress update with a copy of the progress object to avoid mutations
                agentResponse.triggerProgress({...progress});
                
                // Simulate explicit reasoning process
                return `Reasoning process simulated: ${args.reasoning}`;
            },
            observe: async (args: { observation: string }) => {
                // Update progress tracking
                progress.hasObserved = true;
                progress.lastAction = 'observe';
                progress.lastActionContent = args.observation;
                
                // Send progress update with a copy of the progress object to avoid mutations
                agentResponse.triggerProgress({...progress});
                
                // Simulate summarizing observations
                return `Observation summarized: ${args.observation}`;
            }
        };

        // Main autonomous reasoning loop should be limited to a certain number of iterations
        while (!isTurnCompleted && loopsRemaining > 0) {
            // decrease the loop counter to prevent infinite loops
            loopsRemaining--;
            
            // Update iteration counter in progress tracking
            progress.currentIteration = this.MAX_ITERATIONS - loopsRemaining;
            
            console.log(`Current iteration of the autonomous loop: ${progress.currentIteration} of ${this.MAX_ITERATIONS}`);
            try {
                // Call the OpenAI API
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o", // Use appropriate model
                    messages: messages,
                    tools: inbuiltToolSchemas,
                });

                const message = response.choices[0].message;

                // Add the AI's message to the conversation
                messages.push(message);

                // debug console log
                console.log("[DEBUG] AI response:", message);

                // Check if the AI wants to call a tool
                if (message.tool_calls && message.tool_calls.length > 0) {
                    for (const toolCall of message.tool_calls) {
                        if (toolCall.type === 'function') {
                            const functionName = toolCall.function.name;
                            const functionArgs = JSON.parse(toolCall.function.arguments);
                            
                            console.log(`Function called: ${functionName}`);
                            
                            // Track unique tool calls
                            progress.uniqueToolCalls.add(functionName);
                            
                            if (inbuiltToolHandlers[functionName]) {
                                // Execute the function
                                const functionResult = await inbuiltToolHandlers[functionName](functionArgs);
                                
                                // Add the function result to the conversation
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify(functionResult)
                                });
                            } else {
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: "Function not found" })
                                });
                                
                                // Send a progress update for the "function not found" case
                                progress.lastAction = 'error';
                                progress.lastActionContent = `Function "${functionName}" not found`;
                                agentResponse.triggerProgress({...progress});
                            }
                        }
                    }
                } else if (message.content) {
                    // If the AI responded with content, this might be the final answer
                    // We check if it's a substantial message by looking at reasoning steps and observations
                    if (progress.hasThought && progress.hasObserved && progress.reasoningSteps >= 1) {
                        // This appears to be a final answer after proper reasoning
                        isTurnCompleted = true;
                        finalResponse = message.content as string;
                        
                        // Update progress to show we've completed
                        progress.lastAction = 'completed';
                        agentResponse.triggerProgress({...progress});
                        
                        agentResponse.setResponseText(finalResponse);
                        agentResponse.triggerComplete();
                    } else {
                        // Remind it to follow the ReAct pattern first
                        messages.push({
                            role: 'user',
                            content: 'Please follow the ReAct pattern. Use the "think" tool to share your reasoning and "observe" tool to summarize findings before providing your final answer.'
                        });
                    }
                }
            } catch (error) {
                console.error("Error in autonomous loop:", error);
                isTurnCompleted = true;
                finalResponse = "An error occurred while processing your request.";
                
                // Update progress to show error
                progress.lastAction = 'error';
                agentResponse.triggerProgress({...progress});
                
                // Set the error response text and trigger error event
                agentResponse.setResponseText(finalResponse);
                agentResponse.triggerError(error);
            }
        }

        // If we've reached the iteration limit without completion
        if (!isTurnCompleted) {
            console.log("Maximum iterations reached. Extracting final response from conversation history.");
            // Update progress to show we've reached the maximum iterations
            progress.currentIteration = this.MAX_ITERATIONS;
            progress.lastAction = 'max_iterations_reached';
            agentResponse.triggerProgress({...progress});
            
            // Extract the best possible response from conversation history
            const extractedResponse = this.extractFinalResponseFromHistory(messages, progress);
            agentResponse.setResponseText(extractedResponse);
            agentResponse.triggerComplete();
        }
    }

    /**
     * Extract a reasonable final response from the conversation history when the agent
     * doesn't explicitly complete with a final answer
     * 
     * @param messages The conversation history
     * @param progress The progress tracking object
     * @returns A reasonable final response based on the conversation history
     */
    private extractFinalResponseFromHistory(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        progress: AgentProgressData
    ): string {
        // If we have observations, those are most likely to contain useful summaries
        const observations = messages
            .filter(m => 
                m.role === 'tool' && 
                typeof m.content === 'string' && 
                m.content.startsWith('Observation summarized:'))
            .map(m => m.content as string);
        
        if (observations.length > 0) {
            // Get the most recent observation as it likely has the most complete information
            return observations[observations.length - 1].replace('Observation summarized: ', '');
        }
        
        // If no observations, look for assistant messages with content
        const assistantMessages = messages
            .filter(m => 
                m.role === 'assistant' && 
                typeof m.content === 'string' && 
                m.content.length > 0)
            .map(m => m.content as string);
        
        if (assistantMessages.length > 0) {
            // Get the longest message as it likely has the most information
            return assistantMessages.sort((a, b) => b.length - a.length)[0];
        }
        
        // If all else fails, provide a generic response
        return "I've analyzed your request but couldn't formulate a complete response within the iteration limit. " +
               "Based on the information gathered, here's my best answer: " +
               (progress.uniqueToolCalls.size > 0 ? 
                "I've done some analysis but couldn't reach a definitive conclusion." : 
                "I wasn't able to gather sufficient information to provide a complete answer.");
    }
}