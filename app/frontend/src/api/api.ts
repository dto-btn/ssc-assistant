interface CompletionProps {
  request: MessageRequest;
  updateLastMessage: (message_chunk: string) => void;
  accessToken: string;
}

export async function completionMySSC({ request, updateLastMessage, accessToken }: CompletionProps): Promise<Completion> {
  let completion: Completion | undefined;

  let url = "/api/1.0/completion/chat/stream";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken.trim()
    },
    body: JSON.stringify(request)
  });

  if (response.status === 401) {
    throw new Error('Unauthorized: You are not authorized to make this request.');
  }

  if (response.status === 400) {
    const responseBody = await response.json();
    throw new Error(responseBody.message || "BadRequestError");
  }

  const contentTypeHeader = response.headers.get('Content-Type');
  const boundaryMatch = contentTypeHeader?.match(/boundary=(.*)$/);
  if (!boundaryMatch) {
    throw new Error('Boundary not found in the content type header.');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body reader not available.');
  }

  const decoder = new TextDecoder('utf-8');
  let partialData = '';

  const startBoundaryRegex = /--GPT-Interaction\s+Content-Type: text\/plain\s+/;
  const endBoundaryRegex = /--GPT-Interaction\s+Content-Type: application\/json/;
  const finalBoundaryRegex = /--GPT-Interaction--/;
  const contentRegex = new RegExp(`${startBoundaryRegex.source}([\\s\\S]*?)(?=${endBoundaryRegex.source}|$)`, 's');
  const jsonRegex = new RegExp(`${endBoundaryRegex.source}([\\s\\S]+?)${finalBoundaryRegex.source}`, 's');

  try {
    //TODO: this should be set
    //eslint no-constant-condition: ["error", { "checkLoops": "none" }]
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      partialData += decoder.decode(value, { stream: true });
      const result = contentRegex.exec(partialData);
      if(result && result[1]) {
        const content = result[1].trim();
        updateLastMessage(content);
      }
    }

    //finished reading the stream, let's load the json object properly this time and populate the rest of the answer.
    const json = jsonRegex.exec(partialData);
    if(json && json[1]){
      completion = JSON.parse(json[1]);
    }

    if (!completion) {
      throw new Error('Failed to obtain completion from the server response.');
    }
  } catch (error) {
    console.error('Error while reading the stream:', error);
    throw error;
  } finally {
    reader.releaseLock();
  }

  return completion;
}

export async function sendFeedback(feedback: string, isGoodResponse: boolean, uuid: string): Promise<Response> {
  const url = "/api/1.0/feedback";

  const feedbackObject = {
    feedback,
    positive: isGoodResponse,
    uuid
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(feedbackObject)
  });

  if (!response.ok) {
    throw new Error('Failed to send feedback');
  }

  return response;
}

export async function bookReservation(bookingDetails: BookingConfirmation): Promise<Response> {
  const url = "/api/1.0/book_reservation";

  const bookingResponse = await fetch(url, {
    method: "POST",
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bookingDetails)
  })

  if (!bookingResponse.ok) {
    throw new Error("Failed to book reservation");
  }

  return bookingResponse;
}