import AxeBuilder from '@axe-core/playwright';
import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

/**
 * Fail with a readable summary when axe finds accessibility violations.
 */
export async function expectNoAxeViolations(page: Page, scopeName: string): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const summary = results.violations
    .map((violation) => {
      const targets = violation.nodes
        .map((node) => node.target.join(' > '))
        .join(', ');

      return `${violation.id} (${violation.impact ?? 'unknown'}): ${targets}`;
    })
    .join('\n');

  expect(
    results.violations,
    summary.length > 0
      ? `Expected no axe violations for ${scopeName}, but found:\n${summary}`
      : `Expected no axe violations for ${scopeName}.`,
  ).toEqual([]);
}

/**
 * Advance keyboard focus until the requested control is focused.
 */
export async function tabUntilFocused(
  page: Page,
  locator: Locator,
  controlName: string,
  maxTabs = 30,
): Promise<void> {
  for (let tabIndex = 0; tabIndex < maxTabs; tabIndex += 1) {
    if (await locator.evaluate((element) => element === document.activeElement)) {
      await expect(locator, `${controlName} should be keyboard focusable.`).toBeFocused();
      return;
    }

    await page.keyboard.press('Tab');
  }

  await expect(locator, `${controlName} should be reachable through keyboard traversal.`).toBeFocused();
}

/**
 * Assert that the current document reflows without horizontal scrolling.
 */
export async function expectNoHorizontalOverflow(page: Page, scopeName: string): Promise<void> {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;

    return {
      clientWidth: doc.clientWidth,
      scrollWidth: Math.max(doc.scrollWidth, body?.scrollWidth ?? 0),
    };
  });

  expect(
    metrics.scrollWidth,
    `${scopeName} should reflow without horizontal scrolling.`,
  ).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

/**
 * Assert that a primary interactive control meets the minimum touch target size.
 */
export async function expectMinimumTouchTargetSize(
  locator: Locator,
  controlName: string,
  minimumSize = 44,
): Promise<void> {
  await expect(locator, `${controlName} should be visible before size checks.`).toBeVisible();

  const bounds = await locator.boundingBox();
  expect(bounds, `${controlName} should have a measurable bounding box.`).not.toBeNull();

  expect(bounds!.width, `${controlName} should be at least ${minimumSize}px wide.`)
    .toBeGreaterThanOrEqual(minimumSize);
  expect(bounds!.height, `${controlName} should be at least ${minimumSize}px tall.`)
    .toBeGreaterThanOrEqual(minimumSize);
}