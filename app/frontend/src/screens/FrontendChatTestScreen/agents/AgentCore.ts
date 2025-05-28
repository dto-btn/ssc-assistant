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
        // Track conversation context
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: `
The current local time is ${new Date().toISOString()}. 

You are an autonomous reasoning agent that can think through multiple steps before responding. When you receive a query, analyze what information you need and take any actions you need to. Then, continue your reasoning until you have a complete answer.

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
            searchInformation: async (args: { topic: string }) => {
                // Simulate retrieving information
                return `Information about ${args.topic}: This is simulated search result data.`;
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
            
            console.log("Current iteration of the autonomous loop: ", );
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
                    // then do nothing
                    messages.push({
                        role: 'user',
                        content: 'Please call the iAmDone tool with your final answer to complete the interaction.'
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
            const errorMessage = `Maximum iterations (${this.MAX_ITERATIONS}) reached without completion`;
            agentResponse.setResponseText(errorMessage);
            agentResponse.triggerError(new Error(errorMessage));
        }
    }
}