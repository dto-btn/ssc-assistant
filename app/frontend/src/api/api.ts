import { ChatWith } from "../App";

interface CompletionProps {
  request: MessageRequest;
  updateLastMessage: (message_chunk: string) => void;
  chatWith: ChatWith;
}

export async function completionMySSC({ request, updateLastMessage, chatWith }: CompletionProps): Promise<Completion> {
  let completion: Completion | undefined;
  let streamingContent = '';

  let url = "/api/1.0/completion/" + (chatWith == ChatWith.Data ? "myssc" : "chat") + "/stream";
  console.log(chatWith);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(request)
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: You are not authorized to make this request.');
  }

  const contentTypeHeader = response.headers.get('Content-Type');
  const boundaryMatch = contentTypeHeader?.match(/boundary=(.*)$/);
  if (!boundaryMatch) {
    throw new Error('Boundary not found in the content type header.');
  }

  //const boundary = boundaryMatch[1];
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body reader not available.');
  }

  const decoder = new TextDecoder('utf-8');
  let partialData = '';

  //const regex = `/--${boundary}\s+Content-Type: text\/plain\s+([\s\S]+?)\s+--${boundary}\s+Content-Type: application\/json/`;
  const startBoundaryRegex = /--GPT-Interaction\s+Content-Type: text\/plain\s+/;
  const endBoundaryRegex = /--GPT-Interaction\s+Content-Type: application\/json/;
  const finalBoundaryRegex = /--GPT-Interaction--/;
  const contentRegex = new RegExp(`${startBoundaryRegex.source}([\\s\\S]+?)(${endBoundaryRegex.source}|$)`, 's');
  const jsonRegex = new RegExp(`${endBoundaryRegex.source}([\\s\\S]+?)${finalBoundaryRegex.source}`, 's');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      partialData += decoder.decode(value, { stream: true });
      const result = contentRegex.exec(partialData);
      if(result && result[1]) {
        const content = streamingContent = result[1].trim();
        updateLastMessage(content);
      }
    }

    //finished reading the stream, let's load the json object properly this time and populate the rest of the answer.
    const json = jsonRegex.exec(partialData);
    if(json && json[1]){
      completion = JSON.parse(json[1]);
    }
  } catch (error) {
    console.error('Error while reading the stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return completion ||  {
                          message: {
                            role:'assistant', 
                            content: streamingContent
                          }
                        }
}