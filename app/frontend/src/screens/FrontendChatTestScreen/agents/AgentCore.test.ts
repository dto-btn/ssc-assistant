import { describe, it } from "vitest";
import { AgentCore } from "./AgentCore";
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCoreMemory } from "./AgentCoreMemory";

describe('AgentCore', () => {
    it('can', () => new Promise<void>((resolve, reject) => {
        const openai = provideProxyOpenAiClient({
            apiRootDomain: 'http://localhost:5001'
        });
        const memory = new AgentCoreMemory();
        const agentCore = new AgentCore(openai, memory);
        // A simple prompt that will force the agent to think at least 25 times before responding.
        const response = agentCore.processQuery(
`You need to solve a complex problem using specific thinking tools. 

Make sure you only respond with 1 step at a time.

For each step, you MUST use the format:
        
        THINKING STEP #[number]: [detailed explanation of your current reasoning]
        CURRENT RESULT: [intermediate result]
        
        Problem: You are designing a recursive algorithm to count valid paths in a grid.
        1. Start with a 3x3 grid where you can only move right or down.
        2. Define what makes a path valid mathematically.
        3. Analyze how many valid paths exist from top-left to bottom-right.
        4. Identify a recurrence relation for this problem.
        5. Implement the solution using dynamic programming.
        6. Calculate the time and space complexity.
        7. Extend your solution to a 4x4 grid.
        8. Consider obstacles in the grid and how they affect your algorithm.
        9. Compare recursive vs iterative approaches.
        10. Discuss optimizations for large grids.
        
        You MUST show at least 25 explicit thinking steps, showing your complete reasoning process.
        For EACH thinking step, explain exactly what you're considering and why.
        DO NOT skip steps in your reasoning or provide a shortened analysis.`
        )
        
        // The response object is returned immediately, but processing happens asynchronously
        console.log("Response object returned:", response);
        
        // Example of adding listeners to the response
        memory.onUpdate((event) => {
            console.log("Update event received:", event);
            if (event.type === 'action-added') {
                console.log("Action added to turn index", event.turnIndex, ":", event.action);
            }
        });
    }), 500000)
});