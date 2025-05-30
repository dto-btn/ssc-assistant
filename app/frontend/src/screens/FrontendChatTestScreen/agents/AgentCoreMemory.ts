import { ChatCompletion } from "openai/resources/index.mjs";

export class AgentCoreMemory {
    /**
     * This method maps an OpenAI response to the agent's memory.
     * @param response 
     */
    loadFromOpenAI(response: ChatCompletion) {
        if (!response.choices || response.choices.length === 0) {
            throw new Error("Invalid OpenAI response: No choices found.");
        }

        response.choices.forEach((choice, i) => {
            if (!choice.message || !choice.message.role || !choice.message.content) {
                throw new Error(`Invalid OpenAI response: Choice ${i} is missing message, role, or content.`);
            }
        });
    }
  
}
