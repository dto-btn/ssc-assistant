import { AgentCore } from "../AgentCore";
import { AgentCoreConnection, AgentProgressData } from "../AgentCoreResponse";
import { AzureOpenAI } from "openai";

// This demo shows how to use the AgentCoreConnection to listen for progress events
export class ProgressListenerDemo {

    // This method demonstrates how to use the progress listener
    public static async runDemo(openaiClient: AzureOpenAI): Promise<void> {
        const agentCore = new AgentCore(openaiClient);
        
        // Create a query to process
        const query = "Explain the concept of autonomous agents in AI";
        
        // Get the AgentCoreConnection
        const connection = agentCore.processQuery(query);
        
        // Register listeners
        
        // Listen for progress events
        connection.onProgress((progressData: AgentProgressData) => {
            // Display progress data in a user-friendly format
            console.log("\n--- AGENT PROGRESS UPDATE ---");
            console.log(`Iteration: ${progressData.currentIteration}/${progressData.maxIterations}`);
            console.log(`Has thought: ${progressData.hasThought ? '✅' : '❌'}`);
            console.log(`Has observed: ${progressData.hasObserved ? '✅' : '❌'}`);
            console.log(`Reasoning steps: ${progressData.reasoningSteps}`);
            console.log(`Last action: ${progressData.lastAction || 'None'}`);
            console.log(`Tool calls: ${Array.from(progressData.uniqueToolCalls).join(', ') || 'None'}`);
            
            // You could update a progress bar or status indicator in the UI here
            const percentComplete = (progressData.currentIteration / progressData.maxIterations) * 100;
            console.log(`Completion: ${percentComplete.toFixed(0)}%`);
            console.log("-------------------------------\n");
        });
        
        // Listen for completion
        connection.onComplete(() => {
            console.log("\n=== PROCESSING COMPLETE ===");
            console.log("Final response:");
            console.log(connection.getResponseText());
            console.log("===========================\n");
        });
        
        // Listen for errors
        connection.onError((error: unknown) => {
            console.error("\n!!! ERROR OCCURRED !!!");
            console.error("Error details:", error);
            console.error("Error response:", connection.getResponseText());
            console.error("!!!!!!!!!!!!!!!!!!!!!!!!\n");
        });
        
        // Since this is an async process, we need to wait for it to complete in this demo
        // In a real application, the UI would update as events occur
        console.log("Processing query: " + query);
        console.log("Waiting for completion...");
        
        // Simple way to wait for completion in this demo
        await new Promise<void>((resolve) => {
            connection.onComplete(() => resolve());
            connection.onError(() => resolve());
            
            // Fallback timeout after 2 minutes
            setTimeout(() => resolve(), 120000);
        });
    }
    
    // Example of how the progress data could be used to update a UI
    public static getProgressDisplay(progressData: AgentProgressData): string {
        // Create a simple text-based progress bar
        const barLength = 20;
        const completed = Math.round((progressData.currentIteration / progressData.maxIterations) * barLength);
        const progressBar = '█'.repeat(completed) + '░'.repeat(barLength - completed);
        
        return `
Progress: [${progressBar}] ${progressData.currentIteration}/${progressData.maxIterations}
Status: ${progressData.lastAction || 'Starting'}
Thinking: ${progressData.hasThought ? '✅' : '❌'}
Observations: ${progressData.hasObserved ? '✅' : '❌'}
Reasoning Steps: ${progressData.reasoningSteps}
Tool Calls: ${Array.from(progressData.uniqueToolCalls).join(', ') || 'None'}
`;
    }
}
