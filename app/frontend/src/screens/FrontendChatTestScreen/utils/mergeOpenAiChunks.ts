import OpenAI from "openai";

export function mergeOpenAIChunks(chunks: OpenAI.Chat.Completions.ChatCompletionChunk[]): OpenAI.Chat.Completions.ChatCompletion {
  const baseObject: any = {
    id: chunks[0].id,
    model: chunks[0].model,
    object: 'chat.completion',
    created: chunks[0].created,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: ''
      },
      finish_reason: chunks[chunks.length - 1].choices[0].finish_reason || null
    }]
  };
  
  // Combine all content chunks
  baseObject.choices[0].message.content = chunks.reduce((content, chunk) => {
    return content + (chunk.choices[0].delta.content || '');
  }, '');
  
  return baseObject as OpenAI.Chat.Completions.ChatCompletion;
}