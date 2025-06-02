import { useEffect, useMemo, useState } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";
import { AgentCoreMemory } from "../agents/AgentCoreMemory";

export const useAgentCore = () => {
    return useMemo(() => {
        const openai = provideProxyOpenAiClient();
        const memory = new AgentCoreMemory();
        const agentCore = new AgentCore(openai, memory);

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