import { beforeEach, describe, it } from "vitest";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { provideProxyOpenAiClient } from "../providers/provideProxyOpenAiClient";
import { AzureOpenAI } from "openai";
import { withSnapshot } from "../../../util/withSnapshot";
import { ChatCompletion } from "openai/resources/index.mjs";

describe('AgentCoreMemory', () => {
    let memory: AgentCoreMemory;
    let openai: AzureOpenAI;

    beforeEach(() => {
        memory = new AgentCoreMemory();
        openai = provideProxyOpenAiClient({
            apiRootDomain: 'http://localhost:5001'
        });
    });

    describe('mapping from openai', () => {
        let response: ChatCompletion;

        beforeEach(async () => {
            response = await withSnapshot('fixture: mapping from openai', () => {
                return openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: 'Hello, who are you?' }
                    ]
                });
            });
        });

        it('should map', () => {
            
        })
    })
})