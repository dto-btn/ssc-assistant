# OpenAI-Compatible Proxy API

This document explains how to use the OpenAI-compatible proxy API implemented in the SSC Assistant backend.

## Overview

The proxy API allows you to use the OpenAI TypeScript/JavaScript SDK with our backend, which then forwards requests to Azure OpenAI. This provides several benefits:

- Simplified client code that matches OpenAI's official documentation
- Authentication and rate limiting handled by the backend
- Consistent API structure across different LLM providers
- Ability to swap models or providers without changing client code

## Endpoints

The proxy API is available at the following base URL:

```
/api/1.0/ai
```

The following endpoints are supported:

- `POST /api/1.0/ai/chat/completions` - Generate chat completions
- `GET /api/1.0/ai/models` - List available models

## Using with OpenAI SDK

Here's how to use the proxy API with the OpenAI SDK:

```typescript
import OpenAI from 'openai';

// Create a custom OpenAI client pointing to our proxy
const openai = new OpenAI({
  baseURL: '/api/1.0/ai',
  apiKey: 'dummy',  // The actual authentication is handled by the proxy
  dangerouslyAllowBrowser: true, // Only use this for client-side code
});

// Use the client just like you would with OpenAI
async function generateResponse() {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o', // The specific model used is configured on the backend
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: 'Tell me about Shared Services Canada.' }
    ],
    max_tokens: 500,
  });
  
  return completion.choices[0].message.content;
}
```

## Streaming Support

The proxy also supports streaming responses:

```typescript
const stream = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    { role: 'system', content: 'You are a helpful AI assistant.' },
    { role: 'user', content: 'Tell me about Shared Services Canada.' }
  ],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  if (content) {
    // Process each chunk of the response as it arrives
    console.log(content);
  }
}
```

## Environment Variables

The proxy uses the following environment variables:

- `AZURE_OPENAI_ENDPOINT` - Azure OpenAI endpoint URL
- `AZURE_OPENAI_DEPLOYMENT_NAME` - The deployment name to use
- `AZURE_OPENAI_VERSION` - API version (default: '2024-05-01-preview')
- `AZURE_OPENAI_KEY` - Optional API key for authentication

If `AZURE_OPENAI_KEY` is not provided, the proxy will attempt to use Azure AD authentication via DefaultAzureCredential.

## Example Implementation

For a complete example, see the file at:
`/app/frontend/src/examples/openai-proxy-example.ts`
