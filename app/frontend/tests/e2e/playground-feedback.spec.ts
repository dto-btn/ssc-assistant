import type { Locator } from '@playwright/test';

import { test, expect } from './fixtures/playground';

async function submitDialog(button: Locator): Promise<void> {
  await button.evaluate((element: HTMLButtonElement) => {
    element.click();
  });
}

/**
 * Opens the floating system feedback dialog and submits a positive payload.
 */
test('submits system feedback with a positive reaction', async ({ playground, mockPlayground }) => {
  await playground.goto();

  await playground.page.getByRole('button', { name: 'Feedback' }).click();
  const dialog = playground.page.getByRole('dialog', { name: 'Feedback on the system' });
  await expect(dialog).toBeVisible();

  const submitButton = dialog.getByRole('button', { name: 'Submit' });
  await expect(submitButton).toBeDisabled();

  await dialog.getByRole('button', { name: 'Good response' }).click();
  await dialog.getByLabel('Message').fill('The inline feedback form was easy to use.');
  await expect(submitButton).toBeEnabled();

  await submitDialog(submitButton);

  await expect(dialog).toHaveCount(0);

  await expect.poll(() => mockPlayground.getFeedbackSubmissions()).toHaveLength(1);
  await expect.poll(() => mockPlayground.getFeedbackSubmissions()[0]).toEqual({
    feedback: 'The inline feedback form was easy to use.',
    positive: true,
    source: 'playground',
    uuid: expect.any(String),
  });
});

/**
 * Keeps the form guarded until complete and surfaces an error toast when submission fails.
 */
test('validates required fields and shows an error toast for failed system feedback', async ({ playground, mockPlayground }) => {
  await playground.goto();

  await playground.page.getByRole('button', { name: 'Feedback' }).click();
  const dialog = playground.page.getByRole('dialog', { name: 'Feedback on the system' });
  const submitButton = dialog.getByRole('button', { name: 'Submit' });

  await expect(submitButton).toBeDisabled();

  await dialog.getByLabel('Message').fill('Need more detail in the system-level help.');
  await expect(submitButton).toBeDisabled();

  await dialog.getByRole('button', { name: 'Bad response' }).click();
  await expect(submitButton).toBeEnabled();

  mockPlayground.failNextFeedback(500);
  await submitDialog(submitButton);

  await expect(dialog).toBeVisible();

  await expect.poll(() => mockPlayground.getFeedbackSubmissions()).toHaveLength(1);
  await expect.poll(() => mockPlayground.getFeedbackSubmissions()[0]).toEqual({
    feedback: 'Need more detail in the system-level help.',
    positive: false,
    source: 'playground',
    uuid: expect.any(String),
  });
});