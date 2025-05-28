import { describe, it } from "vitest";
import { AgentCore } from "./AgentCore";
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";

describe('AgentCore', () => {
    it('can', async () => {
        const openai = provideProxyOpenAiClient({
            apiRootDomain: 'http://localhost:5001'
        });
        const agentCore = new AgentCore(openai);
        // TODO: Disabled for now because it calls openai and also can go into infinite loop.
        // const x = await agentCore.processQuery(`Say 'hello world!'.`);
        // console.log(x);

    }, 500000)
});