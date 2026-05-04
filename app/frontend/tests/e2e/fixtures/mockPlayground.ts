import type { Page, Route } from '@playwright/test';

interface MockStreamResponse {
  text: string;
  chunkDelayMs?: number;
  chunkSize?: number;
  errorMessage?: string;
}

interface MockStoredFile {
  blobName: string;
  url: string;
  originalName: string;
  size: number;
  contentType: string;
  uploadedAt: string;
  lastUpdated: string;
  sessionId: string;
  category: string;
  metadataType?: string;
  sessionName?: string;
  dataUrl?: string;
  extractedText?: string;
}

export interface ArchivedSessionMessageSeed {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface ArchivedSessionSeed {
  sessionId: string;
  sessionName: string;
  messages: ArchivedSessionMessageSeed[];
  uploadedAt?: string;
}

declare global {
  interface Window {
    __SSC_PLAYGROUND_E2E__?: {
      responseQueue: MockStreamResponse[];
      persistentResponse: MockStreamResponse | null;
      clipboardText: string;
      defaultChunkDelayMs: number;
    };
  }
}

const DEFAULT_ASSISTANT_RESPONSE = 'Mock assistant response.';
const DEFAULT_CHUNK_DELAY_MS = 20;
const DEFAULT_CHUNK_SIZE = 14;

/**
 * Encode an arbitrary JSON payload as a data URL suitable for archive rehydration.
 */
function encodeJsonDataUrl(payload: unknown): string {
  return `data:application/json;base64,${Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64')}`;
}

/**
 * Split assistant text into deterministic chunks so stop-generation tests can interrupt mid-stream.
 */
function splitText(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];

  for (let index = 0; index < text.length; index += chunkSize) {
    chunks.push(text.slice(index, index + chunkSize));
  }

  return chunks.length > 0 ? chunks : [''];
}

/**
 * Serialize one SSE event in the format expected by the OpenAI responses client.
 */
function formatSseEvent(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

/**
 * Create a minimal completed response snapshot that the OpenAI responses stream can parse.
 */
function createCompletedResponseSnapshot(responseId: string, text: string) {
  const createdAt = Math.floor(Date.now() / 1000);

  return {
    id: responseId,
    object: 'response',
    created_at: createdAt,
    status: 'completed',
    error: null,
    incomplete_details: null,
    instructions: null,
    max_output_tokens: null,
    model: 'gpt-4.1-mini',
    output: [
      {
        id: `${responseId}-message`,
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [
          {
            type: 'output_text',
            text,
            annotations: [],
          },
        ],
      },
    ],
    parallel_tool_calls: false,
    temperature: 1,
    tool_choice: 'auto',
    tools: [],
    top_p: 1,
    background: false,
    conversation: null,
    metadata: null,
    previous_response_id: null,
    reasoning: { effort: null, summary: null },
    text: { format: { type: 'text' } },
    truncation: 'disabled',
    usage: {
      input_tokens: 12,
      input_tokens_details: { cached_tokens: 0 },
      output_tokens: Math.max(1, text.length),
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 12 + Math.max(1, text.length),
    },
    user: null,
  };
}

/**
 * Build a minimal SSE stream for one assistant response.
 */
function buildAssistantStream(response: MockStreamResponse): string[] {
  const responseId = `resp_${Math.random().toString(36).slice(2, 10)}`;
  const fullResponse = createCompletedResponseSnapshot(responseId, response.text);
  const events: string[] = [];
  let sequenceNumber = 1;

  events.push(
    formatSseEvent({
      type: 'response.created',
      sequence_number: sequenceNumber++,
      response: {
        ...fullResponse,
        status: 'in_progress',
        output: [],
        usage: null,
      },
    }),
  );

  events.push(
    formatSseEvent({
      type: 'response.output_item.added',
      sequence_number: sequenceNumber++,
      output_index: 0,
      item: {
        id: `${responseId}-message`,
        type: 'message',
        status: 'in_progress',
        role: 'assistant',
        content: [],
      },
    }),
  );

  events.push(
    formatSseEvent({
      type: 'response.content_part.added',
      sequence_number: sequenceNumber++,
      output_index: 0,
      content_index: 0,
      item_id: `${responseId}-message`,
      part: {
        type: 'output_text',
        text: '',
        annotations: [],
      },
    }),
  );

  for (const chunk of splitText(response.text, response.chunkSize ?? DEFAULT_CHUNK_SIZE)) {
    events.push(
      formatSseEvent({
        type: 'response.output_text.delta',
        sequence_number: sequenceNumber++,
        output_index: 0,
        content_index: 0,
        item_id: `${responseId}-message`,
        delta: chunk,
      }),
    );
  }

  events.push(
    formatSseEvent({
      type: 'response.completed',
      sequence_number: sequenceNumber++,
      response: fullResponse,
    }),
  );
  events.push('data: [DONE]\n\n');

  return events;
}

/**
 * Build a stable file record that mirrors the playground storage payload shape.
 */
function createStoredFile(file: Partial<MockStoredFile> & Pick<MockStoredFile, 'blobName' | 'originalName' | 'sessionId'>): MockStoredFile {
  const uploadedAt = file.uploadedAt ?? new Date().toISOString();
  const normalizedBlobName = file.blobName.startsWith('/') ? file.blobName.slice(1) : file.blobName;

  return {
    blobName: normalizedBlobName,
    url: file.url ?? `/assistant-chat-files/${normalizedBlobName}`,
    originalName: file.originalName,
    size: file.size ?? 1024,
    contentType: file.contentType ?? 'application/octet-stream',
    uploadedAt,
    lastUpdated: file.lastUpdated ?? uploadedAt,
    sessionId: file.sessionId,
    category: file.category ?? 'files',
    metadataType: file.metadataType,
    sessionName: file.sessionName,
    dataUrl: file.dataUrl,
    extractedText: file.extractedText,
  };
}

/**
 * Convert one stored file into the JSON shape returned by the playground API.
 */
function toApiFile(file: MockStoredFile) {
  return {
    blobName: file.blobName,
    originalName: file.originalName,
    url: file.url,
    size: file.size,
    contentType: file.contentType,
    uploadedAt: file.uploadedAt,
    lastUpdated: file.lastUpdated,
    sessionId: file.sessionId,
    category: file.category,
    metadataType: file.metadataType,
    sessionName: file.sessionName,
  };
}

/**
 * Stateful browser-bound mock server for the playground APIs and streamed responses.
 */
export class MockPlaygroundApi {
  private readonly filesBySessionId = new Map<string, MockStoredFile[]>();

  private readonly deletedSessionIds = new Set<string>();

  private uploadCounter = 0;

  constructor(private readonly page: Page) {}

  /**
   * Install all browser-level mocks required by the playground e2e suite.
   */
  async install(): Promise<void> {
    await this.page.addInitScript(({ defaultChunkDelayMs, defaultAssistantResponse }) => {
      const state = {
        responseQueue: [] as Array<{ text: string; chunkDelayMs?: number; chunkSize?: number; errorMessage?: string }>,
        persistentResponse: null as { text: string; chunkDelayMs?: number; chunkSize?: number; errorMessage?: string } | null,
        clipboardText: '',
        defaultChunkDelayMs,
      };

      Object.defineProperty(window, '__SSC_PLAYGROUND_E2E__', {
        value: state,
        configurable: true,
      });

      const clipboard = {
        writeText: async (text: string) => {
          state.clipboardText = text;
        },
        readText: async () => state.clipboardText,
      };

      Object.defineProperty(navigator, 'clipboard', {
        value: clipboard,
        configurable: true,
      });

      const originalFetch = window.fetch.bind(window);

      const splitTextIntoChunks = (text: string, chunkSize: number) => {
        const chunks: string[] = [];
        for (let index = 0; index < text.length; index += chunkSize) {
          chunks.push(text.slice(index, index + chunkSize));
        }
        return chunks.length > 0 ? chunks : [''];
      };

      const toSse = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

      const buildStreamEvents = (responseText: string, chunkSize: number) => {
        const responseId = `resp_${Math.random().toString(36).slice(2, 10)}`;
        const createdAt = Math.floor(Date.now() / 1000);
        const completedResponse = {
          id: responseId,
          object: 'response',
          created_at: createdAt,
          status: 'completed',
          error: null,
          incomplete_details: null,
          instructions: null,
          max_output_tokens: null,
          model: 'gpt-4.1-mini',
          output: [
            {
              id: `${responseId}-message`,
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [
                {
                  type: 'output_text',
                  text: responseText,
                  annotations: [],
                },
              ],
            },
          ],
          parallel_tool_calls: false,
          temperature: 1,
          tool_choice: 'auto',
          tools: [],
          top_p: 1,
          background: false,
          conversation: null,
          metadata: null,
          previous_response_id: null,
          reasoning: { effort: null, summary: null },
          text: { format: { type: 'text' } },
          truncation: 'disabled',
          usage: {
            input_tokens: 12,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: Math.max(1, responseText.length),
            output_tokens_details: { reasoning_tokens: 0 },
            total_tokens: 12 + Math.max(1, responseText.length),
          },
          user: null,
        };

        let sequenceNumber = 1;
        const events = [
          toSse({
            type: 'response.created',
            sequence_number: sequenceNumber++,
            response: {
              ...completedResponse,
              status: 'in_progress',
              output: [],
              usage: null,
            },
          }),
          toSse({
            type: 'response.output_item.added',
            sequence_number: sequenceNumber++,
            output_index: 0,
            item: {
              id: `${responseId}-message`,
              type: 'message',
              status: 'in_progress',
              role: 'assistant',
              content: [],
            },
          }),
          toSse({
            type: 'response.content_part.added',
            sequence_number: sequenceNumber++,
            output_index: 0,
            content_index: 0,
            item_id: `${responseId}-message`,
            part: {
              type: 'output_text',
              text: '',
              annotations: [],
            },
          }),
        ];

        for (const chunk of splitTextIntoChunks(responseText, chunkSize)) {
          events.push(
            toSse({
              type: 'response.output_text.delta',
              sequence_number: sequenceNumber++,
              output_index: 0,
              content_index: 0,
              item_id: `${responseId}-message`,
              delta: chunk,
            }),
          );
        }

        events.push(
          toSse({
            type: 'response.completed',
            sequence_number: sequenceNumber++,
            response: completedResponse,
          }),
        );
        events.push('data: [DONE]\n\n');

        return events;
      };

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

        if (!url.includes('/v1/responses')) {
          return originalFetch(input, init);
        }

        const scenario = state.responseQueue.shift() ?? state.persistentResponse ?? { text: defaultAssistantResponse };
        if (scenario.errorMessage) {
          throw new Error(scenario.errorMessage);
        }

        const chunkDelayMs = scenario.chunkDelayMs ?? state.defaultChunkDelayMs;
        const chunks = buildStreamEvents(scenario.text, scenario.chunkSize ?? 14);
        const encoder = new TextEncoder();
        const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);

        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            let nextChunkIndex = 0;
            let timeoutHandle: number | null = null;

            const abort = () => {
              if (timeoutHandle !== null) {
                window.clearTimeout(timeoutHandle);
                timeoutHandle = null;
              }
              controller.error(new DOMException('The operation was aborted.', 'AbortError'));
            };

            signal?.addEventListener('abort', abort, { once: true });

            const pump = () => {
              if (signal?.aborted) {
                abort();
                return;
              }

              if (nextChunkIndex >= chunks.length) {
                controller.close();
                return;
              }

              controller.enqueue(encoder.encode(chunks[nextChunkIndex]));
              nextChunkIndex += 1;
              timeoutHandle = window.setTimeout(pump, chunkDelayMs);
            };

            pump();
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      };
    }, {
      defaultChunkDelayMs: DEFAULT_CHUNK_DELAY_MS,
      defaultAssistantResponse: DEFAULT_ASSISTANT_RESPONSE,
    });

    const context = this.page.context();

    await context.route('**/api/playground/files-for-session**', async (route) => this.handleListSessionFiles(route));
    await context.route('**/api/playground/upload**', async (route) => this.handleUpload(route));
    await context.route('**/api/playground/extract-file-text**', async (route) => this.handleExtractFile(route));
    await context.route('**/api/playground/sessions', async (route) => this.handleDeleteAllSessions(route));
    await context.route('**/api/playground/sessions/*/rename', async (route) => this.handleRenameSession(route));
    await context.route('**/api/playground/sessions/*', async (route) => this.handleDeleteSession(route));
    await context.route('**/api/1.0/feedback**', async (route) => this.handleFeedback(route));
  }

  /**
   * Queue one streamed assistant response for the next completion request.
   */
  async queueAssistantResponse(response: MockStreamResponse): Promise<void> {
    await this.page.evaluate((queuedResponse) => {
      window.__SSC_PLAYGROUND_E2E__?.responseQueue.push(queuedResponse);
    }, response);
  }

  /**
   * Configure the fallback streamed response used when the queue is empty.
   */
  async setPersistentAssistantResponse(response: MockStreamResponse | null): Promise<void> {
    await this.page.evaluate((persistentResponse) => {
      if (window.__SSC_PLAYGROUND_E2E__) {
        window.__SSC_PLAYGROUND_E2E__.persistentResponse = persistentResponse;
      }
    }, response);
  }

  /**
   * Seed a remotely archived session so bootstrap and rehydration flows have deterministic data.
   */
  seedArchivedSession(session: ArchivedSessionSeed): void {
    const uploadedAt = session.uploadedAt ?? new Date().toISOString();
    const archiveFile = createStoredFile({
      blobName: `${session.sessionId}/${session.sessionId}.chat.json`,
      originalName: `${session.sessionId}.chat.json`,
      sessionId: session.sessionId,
      category: 'chat',
      contentType: 'application/json',
      metadataType: 'chat-archive',
      sessionName: session.sessionName,
      uploadedAt,
      lastUpdated: uploadedAt,
      dataUrl: encodeJsonDataUrl({ messages: session.messages }),
      extractedText: JSON.stringify(session.messages),
    });

    this.filesBySessionId.set(session.sessionId, [archiveFile]);
    this.deletedSessionIds.delete(session.sessionId);
  }

  /**
   * Seed one stored attachment for a session-specific file listing.
   */
  seedSessionFile(file: Omit<MockStoredFile, 'url'> & { url?: string }): void {
    const storedFile = createStoredFile(file);
    const existing = this.filesBySessionId.get(storedFile.sessionId) ?? [];
    existing.push(storedFile);
    this.filesBySessionId.set(storedFile.sessionId, existing);
  }

  /**
   * Remove all remote session seeds so each test can opt into only what it needs.
   */
  clearRemoteState(): void {
    this.filesBySessionId.clear();
    this.deletedSessionIds.clear();
    this.uploadCounter = 0;
  }

  /**
   * Return the flattened remote files visible to the playground bootstrap API.
   */
  private getAllFiles(): MockStoredFile[] {
    return Array.from(this.filesBySessionId.values()).flat();
  }

  /**
   * Locate one stored file by blob name or preview URL.
   */
  private findStoredFile(blobName?: string | null, fileUrl?: string | null): MockStoredFile | undefined {
    return this.getAllFiles().find((file) => {
      const matchesBlobName = blobName && file.blobName === blobName.replace(/^\//, '');
      const matchesFileUrl = fileUrl && (file.url === fileUrl || file.url === new URL(fileUrl, 'http://localhost').pathname);
      return Boolean(matchesBlobName || matchesFileUrl);
    });
  }

  /**
   * Fulfill the session listing endpoint with the current in-memory remote state.
   */
  private async handleListSessionFiles(route: Route): Promise<void> {
    const requestUrl = new URL(route.request().url());
    const sessionId = requestUrl.searchParams.get('sessionId');
    const files = sessionId
      ? (this.filesBySessionId.get(sessionId) ?? [])
      : this.getAllFiles();

    const body = {
      files: files.map(toApiFile),
      deletedSessionIds: Array.from(this.deletedSessionIds),
      sessionDeleted: sessionId ? this.deletedSessionIds.has(sessionId) : false,
    };

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  }

  /**
   * Fulfill uploads for both user attachments and background archive blobs.
   */
  private async handleUpload(route: Route): Promise<void> {
    const payload = route.request().postDataJSON() as {
      encoded_file?: string;
      name?: string;
      sessionId?: string;
      fileType?: string;
      category?: string;
      metadata?: Record<string, string>;
    };
    const sessionId = payload.sessionId ?? 'session-unknown';
    const uploadedAt = new Date().toISOString();
    const normalizedName = (payload.name ?? `upload-${this.uploadCounter + 1}.bin`).trim();
    const blobName = `${sessionId}/${this.uploadCounter += 1}-${normalizedName}`;
    const storedFile = createStoredFile({
      blobName,
      originalName: normalizedName,
      sessionId,
      category: payload.category ?? 'files',
      contentType: payload.fileType ?? 'application/octet-stream',
      uploadedAt,
      lastUpdated: payload.metadata?.lastupdated ?? uploadedAt,
      metadataType: payload.metadata?.type,
      sessionName: payload.metadata?.sessionname,
      dataUrl: payload.encoded_file,
      extractedText: `Extracted text for ${normalizedName}`,
    });

    const existing = this.filesBySessionId.get(sessionId) ?? [];
    existing.push(storedFile);
    this.filesBySessionId.set(sessionId, existing);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ file: toApiFile(storedFile) }),
    });
  }

  /**
   * Fulfill both extraction and archive data URL lookups.
   */
  private async handleExtractFile(route: Route): Promise<void> {
    const payload = route.request().postDataJSON() as {
      blobName?: string;
      fileUrl?: string;
      fileType?: string;
      responseFormat?: string;
    };
    const file = this.findStoredFile(payload.blobName, payload.fileUrl);

    if (payload.responseFormat === 'data_url') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          dataUrl: file?.dataUrl ?? encodeJsonDataUrl({ messages: [] }),
          contentType: file?.contentType ?? payload.fileType ?? 'application/octet-stream',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        extractedText: file?.extractedText ?? `Extracted text for ${(payload.fileUrl ?? payload.blobName ?? 'file').toString()}`,
      }),
    });
  }

  /**
   * Persist a mock session rename by updating all files that belong to the session.
   */
  private async handleRenameSession(route: Route): Promise<void> {
    const pathname = new URL(route.request().url()).pathname;
    const sessionId = decodeURIComponent(pathname.match(/\/sessions\/([^/]+)\/rename$/)?.[1] ?? '');
    const payload = route.request().postDataJSON() as { name?: string };
    const files = this.filesBySessionId.get(sessionId) ?? [];
    const updatedFiles = files.map((file) => ({ ...file, sessionName: payload.name?.trim() || file.sessionName }));
    this.filesBySessionId.set(sessionId, updatedFiles);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ updatedCount: updatedFiles.length }),
    });
  }

  /**
   * Soft-delete a single session from the mock remote state.
   */
  private async handleDeleteSession(route: Route): Promise<void> {
    const pathname = new URL(route.request().url()).pathname;
    const sessionId = decodeURIComponent(pathname.match(/\/sessions\/([^/]+)$/)?.[1] ?? '');
    this.deletedSessionIds.add(sessionId);
    this.filesBySessionId.delete(sessionId);

    await route.fulfill({
      status: 204,
      body: '',
    });
  }

  /**
   * Soft-delete all sessions from the mock remote state.
   */
  private async handleDeleteAllSessions(route: Route): Promise<void> {
    if (route.request().method() !== 'DELETE') {
      await route.fallback();
      return;
    }

    const deletedCount = this.filesBySessionId.size;
    for (const sessionId of this.filesBySessionId.keys()) {
      this.deletedSessionIds.add(sessionId);
    }
    this.filesBySessionId.clear();

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ deletedCount, failed: [] }),
    });
  }

  /**
   * Accept feedback submissions without relying on the shared backend.
   */
  private async handleFeedback(route: Route): Promise<void> {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    });
  }
}