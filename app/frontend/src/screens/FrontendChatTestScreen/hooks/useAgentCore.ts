import { useEffect, useMemo, useState } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";
import { AgentCoreMemory } from "../agents/AgentCoreMemory";
import { AgentToolRegistry } from "../agents/AgentToolRegistry";

export const useAgentCore = () => {
    return useMemo(() => {
        const openai = provideProxyOpenAiClient();
        const memory = new AgentCoreMemory();
        const toolRegistry = new AgentToolRegistry();

        // Register an adder tool as an example
        toolRegistry.registerTool({
            name: 'adder',
            description: 'Adds a list of numbers together. Takes an array of numbers as input. For example, {"numbers": [1, 2, 3]} or {"numbers": [1, 2, 3, 4]}',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((sum, num) => sum + num, 0);
            }
        });

        // Register a subtractor tool as an example
        toolRegistry.registerTool({
            name: 'subtractor',
            description: 'Subtracts a list of numbers from the first number. Takes an array of numbers as input. For example, {"numbers": [10, 2, 3]} will return 5.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((result, num) => result - num);
            }
        });

        // Register a multiplier tool as an example
        toolRegistry.registerTool({
            name: 'multiplier',
            description: 'Multiplies a list of numbers together. Takes an array of numbers as input. For example, {"numbers": [2, 3, 4]} will return 24.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers)) {
                    throw new Error("Invalid input: 'numbers' must be an array.");
                }
                return args.numbers.reduce((product, num) => product * num, 1);
            }
        });

        // Register a divider tool as an example
        toolRegistry.registerTool({
            name: 'divider',
            description: 'Divides the first number by the second number. Takes an array of two numbers as input. For example, {"numbers": [10, 2]} will return 5.',
            func: async (args: { numbers: number[] }) => {
                if (!Array.isArray(args.numbers) || args.numbers.length !== 2) {
                    throw new Error("Invalid input: 'numbers' must be an array of two numbers.");
                }
                const [numerator, denominator] = args.numbers;
                if (denominator === 0) {
                    throw new Error("Division by zero is not allowed.");
                }
                return numerator / denominator;
            }
        });

        const agentCore = new AgentCore(
            openai,
            memory,
            toolRegistry
        );

        return {
            agentCore,
            openai,
            memory
        }
    }, []);
}

// subscribe to memory.exports
export const useMemoryExports = (memory: AgentCoreMemory) => {
    const [turns, setTurns] = useState(memory.export());

    useEffect(() => {
        const unsubscriber = memory.onUpdate((event) => {
            console.log("Update event received:", event);
            setTurns(memory.export());
        });

        return () => {
            unsubscriber();
        }
    }, [memory]); 
    
    return turns;
}