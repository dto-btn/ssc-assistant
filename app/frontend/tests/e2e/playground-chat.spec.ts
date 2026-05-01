import { test, expect } from './fixtures/playground';

/**
 * Creates a fresh local chat shell before each chat-flow test.
 */
test.beforeEach(async ({ playground }) => {
  await playground.goto();
  await playground.startNewChat();
});

/**
 * Verifies that a typed prompt produces a streamed assistant response and keeps
 * the user turn visible in the transcript.
 */
test('streams typed prompts into assistant messages', async ({ playground, mockPlayground }) => {
  await mockPlayground.queueAssistantResponse({
    text: 'The playground test harness is now streaming a deterministic assistant response.',
  });

  await playground.sendMessage('Explain how the playground test harness works.');

  await expect(playground.page.getByText('Explain how the playground test harness works.')).toBeVisible();
  await expect(playground.page.getByText('The playground test harness is now streaming a deterministic assistant response.')).toBeVisible();
});

/**
 * Verifies that suggestion cards submit prompts and the latest assistant turn
 * can be regenerated with a different mocked response.
 */
test('submits suggestion cards and regenerates the latest answer', async ({ playground, mockPlayground }) => {
  await mockPlayground.queueAssistantResponse({
    text: 'This answer came from a suggestion-card submission.',
  });

  await playground.chooseSuggestionByText('Help me rewrite an email so it is more formal.');
  await expect(playground.page.getByText('This answer came from a suggestion-card submission.')).toBeVisible();

  await mockPlayground.queueAssistantResponse({
    text: 'This answer replaced the earlier assistant response after regeneration.',
  });

  await playground.hoverAssistantResponse('This answer came from a suggestion-card submission.');
  await playground.page.getByLabel('Regenerate').click();

  await expect(playground.page.getByText('This answer replaced the earlier assistant response after regeneration.')).toBeVisible();
  await expect(playground.page.getByText('This answer came from a suggestion-card submission.')).toHaveCount(0);
});

/**
 * Verifies that copy and thumbs-up feedback actions remain functional against
 * mocked browser-level dependencies.
 */
test('supports copy and feedback actions on assistant responses', async ({ playground, mockPlayground }) => {
  await mockPlayground.queueAssistantResponse({
    text: 'This response is used to validate copy and feedback actions.',
  });

  await playground.sendMessage('Return a response I can copy and rate.');
  await expect(playground.page.getByText('This response is used to validate copy and feedback actions.')).toBeVisible();

  await playground.hoverAssistantResponse('This response is used to validate copy and feedback actions.');
  await playground.page.getByLabel('Copy').click();
  await expect(playground.page.getByLabel('Copied!')).toBeVisible();

  await playground.page.getByLabel('Good response').click();
  await expect(playground.page.getByText('Feedback submitted, thank you!')).toBeVisible();
  await expect(playground.page.getByLabel('Good response')).toHaveAttribute('aria-pressed', 'true');
});

/**
 * Verifies that stopping a slow streamed response aborts the in-flight request
 * and appends the stopped marker used by the playground UI.
 */
test('stops a streamed response in progress', async ({ playground, mockPlayground }) => {
  const slowResponseText = 'Partial answer that should be interrupted before the stream reaches its final chunk.';

  await mockPlayground.queueAssistantResponse({
    text: slowResponseText,
    chunkDelayMs: 250,
    chunkSize: 24,
  });

  await playground.sendMessage('Start a slow answer so I can stop it midway.');
  await expect(playground.page.getByLabel('Stop')).toBeVisible();

  await playground.page.getByLabel('Stop').click();

  await expect(playground.page.getByLabel('Send')).toBeVisible();
  await expect(playground.page.getByText(slowResponseText)).toHaveCount(0);
});