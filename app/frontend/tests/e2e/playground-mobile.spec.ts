import { test, expect } from './fixtures/playground';
import {
  expectMinimumTouchTargetSize,
  expectNoHorizontalOverflow,
} from './support/accessibility';

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

/**
 * Verifies mobile layouts reflow cleanly, keep the composer visible after
 * viewport changes, and preserve minimum target sizes on primary controls.
 */
test('keeps mobile controls usable across viewport changes', async ({ playground }, testInfo) => {
  test.skip(!isMobileProject(testInfo.project.name), 'Mobile-only responsive coverage.');

  await playground.goto();
  await playground.startNewChat();

  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, 'initial mobile layout');

  await expectMinimumTouchTargetSize(playground.sidebarToggle(), 'sidebar toggle');
  await expectMinimumTouchTargetSize(
    playground.page.getByRole('button', { name: 'Chat with us!' }),
    'chat with us button',
  );
  await expectMinimumTouchTargetSize(
    playground.page.getByRole('button', { name: /Passer au français|Switch to English/ }),
    'language toggle',
  );
  await expectMinimumTouchTargetSize(playground.page.getByLabel('Send'), 'send button');

  await playground.openSessionNavigation();
  await expectMinimumTouchTargetSize(
    playground.page.getByRole('button', { name: 'New' }),
    'new chat button',
  );
  await expectNoHorizontalOverflow(playground.page, 'mobile drawer layout');
  await playground.closeSessionNavigationIfNeeded();

  await playground.page.setViewportSize({ width: 320, height: 640 });
  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, 'narrow mobile layout');

  await playground.page.setViewportSize({ width: 568, height: 320 });
  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, 'mobile landscape layout');
});