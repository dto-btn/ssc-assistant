import { describe, it } from "vitest";
import { AgentCore } from "./AgentCore";
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";

describe('AgentCore', () => {
    it('can', async () => {
        const openai = provideProxyOpenAiClient({
            apiRootDomain: 'http://localhost:5001'
        });
        const agentCore = new AgentCore(openai);
        // A simple prompt that will force the agent to think at least 25 times before responding.
        const x = await agentCore.processQuery(
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
        console.log(x);

    }, 500000)
});