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

  const newChatButton = playground.page.getByRole('button', { name: 'Start a new chat', exact: true });
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

  await expect(playground.composer()).toBeVisible();
  await expectNoHorizontalOverflow(playground.page, '200% zoom-equivalent playground layout');
});

/**
 * WCAG 1.3.1 — assert the landmark structure matches the required page layout.
 * Expects exactly one banner, one main, one nav, and one contentinfo landmark.
 */
test('has the required ARIA landmark structure', async ({ playground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop landmark coverage.');

  await playground.goto();

  // AppBar provides the banner landmark (role="banner" is implicit on <header>).
  await expect(playground.page.getByRole('banner')).toHaveCount(1);

  // PlaygroundRoot's <Box component="main"> provides the main landmark.
  await expect(playground.page.getByRole('main')).toHaveCount(1);

  // SessionSidebar's <Box component="nav"> provides the navigation landmark.
  await expect(playground.page.getByRole('navigation')).toHaveCount(1);

  // ChatInput's <Box component="footer"> provides the contentinfo landmark.
  await playground.startNewChat();
  await expect(playground.page.getByRole('contentinfo')).toHaveCount(1);
});

/**
 * WCAG 1.3.1 — the page must contain exactly one h1 heading.
 */
test('has exactly one h1 heading', async ({ playground }) => {
  await playground.goto();
  await expect(playground.page.locator('h1')).toHaveCount(1);
});

/**
 * WCAG 2.4.1 — skip link is present in the DOM and moves focus to main content
 * when activated via keyboard.
 */
test('skip link focuses main content', async ({ playground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop skip-link coverage.');

  await playground.goto();

  // The skip link should be the first focusable element.
  await playground.page.keyboard.press('Tab');
  const focused = playground.page.locator(':focus');
  await expect(focused).toHaveAttribute('href', '#playground-main-content');

  // Activating it should move focus to the main content container.
  await playground.page.keyboard.press('Enter');
  await expect(playground.page.locator('#playground-main-content')).toBeFocused();
});

/**
 * WCAG 1.3.1 — each chat message has an accessible label identifying the sender
 * so screen readers can announce who wrote the message before reading its content.
 */
test('chat messages have accessible sender labels', async ({ playground, mockPlayground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop message label coverage.');

  await playground.goto();
  await playground.startNewChat();

  await mockPlayground.queueAssistantResponse({ text: 'Hello, I am the assistant.' });
  await playground.sendMessage('Hello');

  // Wait for the assistant response to complete.
  await expect(playground.page.getByText('Hello, I am the assistant.')).toBeVisible({ timeout: 10_000 });

  // The user message list item should be labelled with something identifying the sender.
  const userMessage = playground.page.getByRole('listitem').filter({ hasText: 'Hello' }).first();
  await expect(userMessage).toHaveAttribute('aria-label', /your message/i);

  // The assistant message list item should be labelled with the assistant's name.
  const assistantMessage = playground.page.getByRole('listitem').filter({ hasText: 'Hello, I am the assistant.' }).first();
  await expect(assistantMessage).toHaveAttribute('aria-label', /SSC Assistant/i);
});

/**
 * WCAG 4.1.3 — the active assistant message container signals aria-busy="true"
 * while streaming and removes it (or sets it to false) once the response completes.
 */
test('streaming assistant message is marked aria-busy during generation', async ({ playground, mockPlayground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop aria-busy coverage.');

  await playground.goto();
  await playground.startNewChat();

  // Queue a response with a deliberate delay so the streaming phase is observable.
  await mockPlayground.queueAssistantResponse({
    text: 'Streaming response content.',
    chunkDelayMs: 80,
    chunkSize: 5,
  });

  await playground.sendMessage('Test streaming');

  // During or immediately after sending, the latest assistant bubble should be busy.
  // We locate the message log and check that an aria-busy item appears.
  const messageLog = playground.page.getByRole('log');
  await expect(messageLog.locator('[aria-busy="true"]')).toHaveCount(1, { timeout: 5_000 });

  // Once the response completes, aria-busy should be cleared.
  await expect(playground.page.getByText('Streaming response content.')).toBeVisible({ timeout: 15_000 });
  await expect(messageLog.locator('[aria-busy="true"]')).toHaveCount(0);
});

/**
 * Run axe on the playground with a populated transcript (user message + assistant
 * response) to catch violations that only appear with message content present.
 */
test('passes automated accessibility checks with a populated transcript', async ({ playground, mockPlayground }, testInfo) => {
  test.skip(isMobileProject(testInfo.project.name), 'Desktop axe transcript coverage.');

  await playground.goto();
  await playground.startNewChat();

  await mockPlayground.queueAssistantResponse({ text: 'Axe check assistant response.' });
  await playground.sendMessage('Axe check user message');

  await expect(playground.page.getByText('Axe check assistant response.')).toBeVisible({ timeout: 10_000 });

  await expectNoAxeViolations(playground.page, 'populated playground transcript');
});