interface CompletionProps {
  request: MessageRequest;
  updateLastMessage: (message_chunk: string) => void;
  accessToken: string;
  signal: AbortSignal;
}

function convertMessagesForAPI(messages: Message[]): ApiMessageDto[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    context: message.context,
    tools_info: message.tools_info,
    quotedText: message.quotedText,
    attachments: message.attachments && message.attachments.map((att) => ({
      type: att.type,
      blob_storage_url: att.blob_storage_url
    }))
  }));
}

function convertRequestForAPI(request: MessageRequest): ApiMessageRequestDto {
  return {
    query: request.query,
    messages: convertMessagesForAPI(request.messages || []),
    top: request.top,
    lang: request.lang,
    max: request.max,
    tools: request.tools,
    uuid: request.uuid,
    quotedText: request.quotedText,
    model: request.model,
    fullName: request.fullName,
  };
}

export async function completionMySSC({ request, updateLastMessage, accessToken, signal }: CompletionProps): Promise<Completion> {
  let completion: Completion | undefined;
  const url = "/api/1.0/completion/chat/stream";

  const api_request = convertRequestForAPI(request);
  

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken.trim()
    },
    body: JSON.stringify(api_request),
    signal
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

export async function uploadFile(encodedFile: string, name: string, accessToken: string): Promise<Attachment> {
  const url = "/api/1.0/upload";

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken.trim()
    },
    body: JSON.stringify({ "encoded_file": encodedFile, "name": name })
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    throw new Error(`Failed to upload file: ${errorMessage}`);
  }

  const responseData = await response.json().catch(
    (error) => {
      console.error("Error while reading the stream:", error);
      throw error;
  });

  const response_url = new URL(responseData.file_url);

  return {
    blob_storage_url: decodeURIComponent(response_url.pathname),
    file_name: name,
    message: responseData.message
  };
}