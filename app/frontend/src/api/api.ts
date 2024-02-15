interface CompletionProps {
  request: MessageRequest;
  updateLastMessage: (message_chunk: string) => void;
  updateHistory: () => void;
}

export async function completionMySSC({ request, updateLastMessage }: CompletionProps): Promise<void> {
  const response = await fetch("/api/1.0/completion/myssc/stream", {
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
  const boundary = boundaryMatch[1];
  console.log(boundary);

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body reader not available.');
  }

  const decoder = new TextDecoder('utf-8');
  let partialData = '';

  const regex = `/--${boundary}\s+Content-Type: text\/plain\s+([\s\S]+?)\s+--${boundary}\s+Content-Type: application\/json/`;
  const startBoundaryRegex = /--GPT-Interaction\s+Content-Type: text\/plain\s+/;
  const endBoundaryRegex = /--GPT-Interaction\s+Content-Type: application\/json/;
  const contentRegex = new RegExp(`${startBoundaryRegex.source}([\\s\\S]+?)(${endBoundaryRegex.source}|$)`, 's');

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      partialData += decoder.decode(value, { stream: true });
      console.log(partialData);
      const result = contentRegex.exec(partialData); 
      if(result && result[1]) {
        const content = result[1].trim();
        updateLastMessage(content);
      }


    }
  } catch (error) {
    console.error('Error while reading the stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }
}