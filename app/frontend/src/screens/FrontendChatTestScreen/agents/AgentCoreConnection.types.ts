
export interface AgentProgressData {
    currentIteration: number;
    maxIterations: number;
    hasThought: boolean;
    hasObserved: boolean;
    reasoningSteps: number;
    uniqueToolCalls: Set<string>;
    lastAction?: string;
    lastActionContent?: string;
}
