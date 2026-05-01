import { test, expect } from './fixtures/playground';

/**
 * Detect whether the current Playwright project uses a mobile viewport/device profile.
 */
function isMobileProject(projectName: string): boolean {
  return projectName.includes('Mobile');
}

/**
 * Verifies that the mobile drawer variant opens from the top bar, closes when a
 * session is selected, and leaves the composer usable on narrow viewports.
 */
test('opens and closes the mobile session drawer around session selection', async ({ playground, mockPlayground }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), 'Mobile-only drawer coverage.');

  mockPlayground.seedArchivedSession({
    sessionId: 'mobile-session-a',
    sessionName: 'Mobile remote chat A',
    uploadedAt: new Date(Date.now() - 1_000).toISOString(),
    messages: [
      {
        id: 'mobile-message-a',
        role: 'assistant',
        content: 'Mobile archived response A.',
        timestamp: Date.now() - 4_000,
      },
    ],
  });
  mockPlayground.seedArchivedSession({
    sessionId: 'mobile-session-b',
    sessionName: 'Mobile remote chat B',
    uploadedAt: new Date(Date.now() - 5_000).toISOString(),
    messages: [
      {
        id: 'mobile-message-b',
        role: 'assistant',
        content: 'Mobile archived response B.',
        timestamp: Date.now() - 3_000,
      },
    ],
  });

  await playground.goto();
  await expect(playground.page.getByText('Mobile archived response A.')).toBeVisible();
  await expect(playground.page.getByText('Mobile archived response B.')).toHaveCount(0);

  await playground.sidebarToggle().click();
  await expect(playground.sessionNavigation()).toBeVisible();

  await playground.selectSession('Mobile remote chat B');

  await expect(playground.page.getByText('Mobile archived response B.')).toBeVisible();
  await expect(playground.page.getByText('Mobile archived response A.')).toHaveCount(0);
  await expect(playground.composer()).toBeVisible();
  await expect(playground.sidebarToggle()).toHaveAttribute('aria-label', 'Open chat sessions');
});