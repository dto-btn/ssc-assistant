import { useMemo } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";
import { AgentCoreMemory } from "../agents/AgentCoreMemory";

export const useAgentCore = () => {
    const agentCore = useMemo(() => {
        const openai = provideProxyOpenAiClient();
        const memory = new AgentCoreMemory();
        return new AgentCore(openai, memory);
    }, []);

    return agentCore;
}