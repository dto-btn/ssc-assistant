import OpenAI from "openai";
import { AgentCoreLlmClientConnection } from "./AgentCoreLlmClientConnection";

export class AgentCoreNonStreamingLlmClient {
    constructor(private openai: OpenAI) {}

    createChatCompletion(
        body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        options?: OpenAI.RequestOptions
    ): AgentCoreLlmClientConnection  {
        const cnx = new AgentCoreLlmClientConnection();
        this.createChatCompletionAsync(cnx, body, options);
        return cnx;
        
    }

    private async createChatCompletionAsync(
        cnx: AgentCoreLlmClientConnection,
        body: OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming,
        options?: OpenAI.RequestOptions
    ): Promise<void> {
        try {
            const response = await this.openai.chat.completions.create(body, options);
            const message = response.choices[0].message;
            if (message) {
                cnx.triggerEvent({
                    type: 'message',
                    data: message
                });
            } else {
                console.warn("No message found in chat completion response");
            }
            cnx.close();
        } catch (error) {
            console.error("Error creating chat completion:", error);
            cnx.close(error);
            return;
        }
    }
}