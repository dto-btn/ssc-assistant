import { test, expect } from './fixtures/playground';

/**
 * Verifies that archived sessions bootstrap correctly, can be renamed, and can
 * be deleted through the session sidebar overflow menu.
 */
test('rehydrates archived sessions and supports rename/delete flows', async ({ playground, mockPlayground }) => {
  mockPlayground.seedArchivedSession({
    sessionId: 'archived-session-a',
    sessionName: 'Recovered project chat',
    messages: [
      {
        id: 'archived-message-1',
        role: 'assistant',
        content: 'Recovered answer from blob storage.',
        timestamp: Date.now() - 5_000,
      },
    ],
  });
  mockPlayground.seedArchivedSession({
    sessionId: 'archived-session-b',
    sessionName: 'Recovered hiring chat',
    messages: [
      {
        id: 'archived-message-2',
        role: 'assistant',
        content: 'A second archived response for selection and deletion.',
        timestamp: Date.now() - 4_000,
      },
    ],
  });

  await playground.goto();

  await playground.openSessionNavigation();
  await expect(playground.page.getByRole('button', { name: 'Recovered project chat' })).toBeVisible();
  await playground.selectSession('Recovered project chat');
  await expect(playground.page.getByText('Recovered answer from blob storage.')).toBeVisible();

  await playground.openSessionOptions('Recovered project chat');
  await playground.page.getByRole('menuitem', { name: 'Rename' }).click();
  await playground.page.getByLabel('Conversation Name').fill('Renamed archived chat');
  await playground.page.getByRole('button', { name: 'Rename' }).click();
  await expect(playground.page.getByRole('button', { name: 'Renamed archived chat' })).toBeVisible();

  await playground.openSessionOptions('Renamed archived chat');
  await playground.page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(playground.page.getByText('Conversation deleted')).toBeVisible();
  await expect(playground.page.getByRole('button', { name: 'Renamed archived chat' })).toHaveCount(0);
  await expect(playground.page.getByRole('button', { name: 'Recovered hiring chat' })).toBeVisible();
});

/**
 * Verifies that supported attachments preview correctly, pending attachments can
 * be removed before send, and unsupported file types surface a visible error.
 */
test('uploads supported files, removes pending files, and rejects unsupported types', async ({ playground, mockPlayground }) => {
  await playground.goto();
  await playground.startNewChat();

  await playground.attachFiles({
    name: 'brief.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('A short brief for the playground attachment test.', 'utf-8'),
  });

  await expect(playground.page.getByText('brief.txt')).toBeVisible();
  await playground.page.locator('[aria-label="Attachments"]').getByLabel('Delete').click();
  await expect(playground.page.getByText('brief.txt')).toHaveCount(0);

  await playground.attachFiles({
    name: 'dangerous.exe',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not-a-real-executable', 'utf-8'),
  });
  await expect(playground.page.getByText('Some files are not supported.')).toBeVisible();

  await playground.attachFiles({
    name: 'summary.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('A supported file that should upload successfully.', 'utf-8'),
  });
  await mockPlayground.queueAssistantResponse({
    text: 'The assistant processed the uploaded attachment successfully.',
  });

  await playground.sendMessage('Use the attached file in your response.');

  await expect(playground.page.getByText('The assistant processed the uploaded attachment successfully.')).toBeVisible();
});