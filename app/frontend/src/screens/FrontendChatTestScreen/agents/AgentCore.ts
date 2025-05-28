import OpenAI, { AzureOpenAI } from "openai";
import { AgentCoreConnection } from "./AgentCoreResponse";

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
        const progress = {
            hasThought: false,
            hasSoughtInformation: false,
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
2. ACT: Take actions to gather information or make progress
3. OBSERVE: Review the results of your actions
4. REPEAT: Continue the process until you have a complete answer

Follow this process for EACH step of your reasoning:
- Use the 'think' tool to explicitly reason through your thoughts
- Use the 'searchInformation' tool to look up information you need
- Use the 'observe' tool to summarize what you've learned

Once you are satisfied that your work is complete, call 'iAmDone' tool with your comprehensive final answer as the 'finalAnswer' parameter - this is the ONLY way to deliver your response to the user.

You have a maximum of ${this.MAX_ITERATIONS} iterations to complete your reasoning. Currently, you have ${loopsRemaining} out of ${this.MAX_ITERATIONS} iterations remaining.
                `
            },
            { role: 'user', content: query }
        ];

        // Define available tools for the agent
        const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
                    name: 'searchInformation',
                    description: 'Search for information about a topic. When the user asks you to search for something, use this function to retrieve relevant information.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'The topic to search for' }
                        },
                        required: ['topic']
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
            },
            {
                type: "function",
                function: {
                    name: 'iAmDone',
                    description: 'Call this function when you have completed your reasoning and have a final answer',
                    parameters: {
                        type: 'object',
                        properties: {
                            finalAnswer: { type: 'string', description: 'Your final answer to the user' }
                        },
                        required: ['finalAnswer']
                    }
                }
            }
        ];

        // Implement the available functions
        const availableFunctions: Record<string, Function> = {
            think: async (args: { reasoning: string }) => {
                // Update progress tracking
                progress.hasThought = true;
                progress.reasoningSteps++;
                // Simulate explicit reasoning process
                return `Reasoning process simulated: ${args.reasoning}`;
            },
            searchInformation: async (args: { topic: string }) => {
                // Update progress tracking
                progress.hasSoughtInformation = true;
                progress.uniqueToolCalls.add('searchInformation');
                // Simulate retrieving information
                return `Information about ${args.topic}: This is simulated search result data.`;
            },
            observe: async (args: { observation: string }) => {
                // Update progress tracking
                progress.hasObserved = true;
                // Simulate summarizing observations
                return `Observation summarized: ${args.observation}`;
            },
            iAmDone: (args: { finalAnswer: string }) => {
                isTurnCompleted = true;
                finalResponse = args.finalAnswer;
                // Set the response text and trigger completion event
                agentResponse.setResponseText(args.finalAnswer);
                agentResponse.triggerComplete();
                return "Reasoning completed.";
            }
        };

        // Main autonomous reasoning loop should be limited to a certain number of iterations
        while (!isTurnCompleted && loopsRemaining > 0) {
            // decrease the loop counter to prevent infinite loops
            loopsRemaining--;
            
            console.log(`Current iteration of the autonomous loop: ${this.MAX_ITERATIONS - loopsRemaining} of ${this.MAX_ITERATIONS}`);
            try {
                // Call the OpenAI API
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o", // Use appropriate model
                    messages: messages,
                    tools: toolSchemas,
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
                            
                            if (availableFunctions[functionName]) {
                                // Execute the function
                                const functionResult = await availableFunctions[functionName](functionArgs);
                                
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
                            }
                        }
                    }
                } else if (message.content) {
                    // If the AI responded with content instead of a tool call,
                    // remind it to follow the ReAct pattern
                    messages.push({
                        role: 'user',
                        content: 'Please follow the ReAct pattern. Use the "think" tool to share your reasoning, "searchInformation" to gather data, "observe" to summarize findings, and "iAmDone" when you have a final answer.'
                    });
                }
            } catch (error) {
                console.error("Error in autonomous loop:", error);
                isTurnCompleted = true;
                finalResponse = "An error occurred while processing your request.";
                // Set the error response text and trigger error event
                agentResponse.setResponseText(finalResponse);
                agentResponse.triggerError(error);
            }
        }

        // If we've reached the iteration limit without completion
        if (!isTurnCompleted) {
            console.log("Maximum iterations reached. Extracting final response from conversation history.");
            // Extract the best possible response from conversation history
            const extractedResponse = this.extractFinalResponseFromHistory(messages, progress);
            agentResponse.setResponseText(extractedResponse);
            agentResponse.triggerComplete();
        }
    }

    /**
     * Extract a reasonable final response from the conversation history when the agent
     * doesn't explicitly complete with iAmDone
     * 
     * @param messages The conversation history
     * @param progress The progress tracking object
     * @returns A reasonable final response based on the conversation history
     */
    private extractFinalResponseFromHistory(
        messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        progress: { hasThought: boolean; hasSoughtInformation: boolean; hasObserved: boolean; uniqueToolCalls: Set<string>; reasoningSteps: number }
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
               (progress.hasSoughtInformation ? 
                "I searched for some information but couldn't reach a definitive conclusion." : 
                "I wasn't able to gather sufficient information to provide a complete answer.");
    }
}