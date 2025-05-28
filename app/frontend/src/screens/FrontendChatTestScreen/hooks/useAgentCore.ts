import { useMemo } from "react"
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AgentCore } from "../agents/AgentCore";

export const useAgentCore = () => {
    const agentCore = useMemo(() => {
        const openai = provideProxyOpenAiClient();
        return new AgentCore(openai);
    }, []);

    return agentCore;
}