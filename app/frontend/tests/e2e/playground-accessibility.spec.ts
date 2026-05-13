import { test, expect } from './fixtures/playground';
import {
  expectNoAxeViolations,
  expectNoHorizontalOverflow,
  tabUntilFocused,
} from './support/accessibility';

/**
 * Detect whether the current Playwright project uses a mobile viewport/device profile.
 */
function isMobileProject(projectName: string): boolean {
  return projectName.includes('Mobile');
}

/**
 * Validate the core shell in both empty and active-chat states with axe.
 */
test('passes automated accessibility checks for shell and active chat states', async ({ playground }) => {
  await playground.goto();
  await expectNoAxeViolations(playground.page, 'initial playground shell');

  await playground.startNewChat();
  await expectNoAxeViolations(playground.page, 'active playground chat');
});

/**
 * Verify that users can create and send a chat using only keyboard traversal.
 */
test('supports a keyboard-only new chat journey', async ({ playground, mockPlayground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop keyboard-only coverage.');

  await playground.goto();

  const newChatButton = playground.page.getByRole('button', { name: 'New' });
  await tabUntilFocused(playground.page, newChatButton, 'new chat button');
  await playground.page.keyboard.press('Enter');

  await expect(playground.composer()).toBeVisible();
  await tabUntilFocused(playground.page, playground.composer(), 'composer');
  await playground.page.keyboard.type('Keyboard-only prompt');
  await expect(playground.composer()).toHaveValue('Keyboard-only prompt');

  await mockPlayground.queueAssistantResponse({
    text: 'Keyboard-only assistant response.',
  });

  await playground.page.keyboard.press('Enter');

  await expect(playground.composer()).toHaveValue('');
  await expect(playground.page.getByText('Keyboard-only assistant response.')).toBeVisible({ timeout: 10_000 });
});

/**
 * Exercise WCAG reflow expectations at a 320 CSS pixel viewport.
 */
test('reflows cleanly at 320 CSS pixels', async ({ playground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop reflow coverage.');

  await playground.page.setViewportSize({ width: 320, height: 900 });
  await playground.goto();
  await playground.startNewChat();

  await expect(playground.sidebarToggle()).toBeVisible();
  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, '320px playground layout');
});

/**
 * Use a narrower desktop viewport as a practical stand-in for 200% browser zoom.
 */
test('reflows cleanly at a 200% zoom-equivalent viewport', async ({ playground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop reflow coverage.');

  await playground.page.setViewportSize({ width: 640, height: 900 });
  await playground.goto();
  await playground.startNewChat();

  await expect(playground.sidebarToggle()).toBeVisible();
  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, '200% zoom-equivalent playground layout');
});