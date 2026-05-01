import { test, expect } from './fixtures/playground';

/**
 * Detect whether the current Playwright project uses a mobile viewport/device profile.
 */
function isMobileProject(projectName: string): boolean {
  return projectName.includes('Mobile');
}

/**
 * Verifies that the playground shell renders, a first chat can be created,
 * and the empty-state suggestion grid is visible to the user.
 */
test('renders the playground shell and creates a first chat session', async ({ playground }) => {
  await playground.goto();

  await playground.openSessionNavigation();
  await expect(playground.sessionNavigation()).toBeVisible();
  await expect(playground.page.getByText('Select or create a chat session to begin.')).toBeVisible();

  await playground.startNewChat();

  await expect(playground.page.getByText('AI may make mistakes. Please validate all information before use.')).toBeVisible();
  await expect(playground.composer()).toBeVisible();
  await expect(playground.suggestionCards()).toHaveCount(6);
});

/**
 * Verifies that desktop layouts can collapse and reopen the session sidebar
 * without losing access to the active chat shell.
 */
test('collapses and reopens the desktop sidebar', async ({ playground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop-only sidebar behaviour.');

  await playground.goto();
  await playground.startNewChat();

  await expect(playground.sidebarToggle()).toHaveAttribute('aria-label', 'Collapse sidebar');
  await playground.sidebarToggle().click();
  await expect(playground.sidebarToggle()).toHaveAttribute('aria-label', 'Open chat sessions');
  await playground.sidebarToggle().click();
  await expect(playground.sidebarToggle()).toHaveAttribute('aria-label', 'Collapse sidebar');
});