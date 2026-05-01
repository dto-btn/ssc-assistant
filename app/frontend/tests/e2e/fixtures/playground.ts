import { expect, test as base } from '@playwright/test';

import { MockPlaygroundApi } from './mockPlayground';
import { PlaygroundPage } from '../pages/PlaygroundPage';

interface PlaygroundFixtures {
  mockPlayground: MockPlaygroundApi;
  playground: PlaygroundPage;
}

/**
 * Shared Playwright fixture set for deterministic playground end-to-end tests.
 */
export const test = base.extend<PlaygroundFixtures>({
  mockPlayground: async ({ page }, use) => {
    const mockPlayground = new MockPlaygroundApi(page);
    await mockPlayground.install();
    await use(mockPlayground);
  },

  playground: async ({ page, mockPlayground }, use) => {
    void mockPlayground;
    await use(new PlaygroundPage(page));
  },
});

export { expect };