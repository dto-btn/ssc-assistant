interface CompletionProps {
  request: MessageRequest;
  updateLastMessage: (message_chunk: string) => void;
  accessToken: string;
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

export async function completionMySSC({ request, updateLastMessage, accessToken }: CompletionProps): Promise<Completion> {
  let completion: Completion | undefined;
  const url = "/api/1.0/completion/chat/stream";

  const api_request = convertRequestForAPI(request);
  

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + accessToken.trim()
    },
    body: JSON.stringify(api_request)
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

export const completionBasic = async (request: MessageRequest, accessToken: String ) => {
  const url = "/api/1.0/completion/chat/stream";
  let token = accessToken;
  if (!token || token.trim() === "") {
      throw new Error("Access token is required for the API request.");
  }

  const api_request = convertRequestForAPI(request);

  // Send the request
  const response = await fetch(url, {
      method: "POST",
      headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token.trim(),
      },
      body: JSON.stringify(api_request),
  });

  if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
  }

  // Parse the response
  const json  = await parseMixedResponse(response);

  // Return the JSON response or handle it as needed
  if (json) {
      return json;
  } else {
      throw new Error("JSON data was not found in the response.");
  }
};

const parseMixedResponse = async (response: Response) => {
    // Read the response as text
    const rawText = await response.text();

    // Split the response by the custom delimiter
    const sections = rawText.split("--GPT-Interaction").map((section) => section.trim());

    // Initialize a place to store the parsed data
    let parsedJson: any = null;
    const plainTextSections: string[] = [];

    // Process each section
    for (const section of sections) {
        // Check for JSON section by looking for the Content-Type: application/json header
        if (section.startsWith("Content-Type: application/json")) {
            const jsonStartIndex = section.indexOf("{");
            if (jsonStartIndex !== -1) {
                try {
                    // Extract the JSON substring and parse it
                    const jsonString = section.substring(jsonStartIndex);
                    parsedJson = JSON.parse(jsonString);
                } catch (error) {
                    console.error("Failed to parse JSON section:", error, section);
                }
            }
        } else if (section.startsWith("Content-Type: text/plain")) {
            // Extract plain text data
            const plainText = section.replace("Content-Type: text/plain", "").trim();
            plainTextSections.push(plainText);
        }
    }

    // Return the processed results
    return {
        json: parsedJson,
        plainTexts: plainTextSections,
    };
};