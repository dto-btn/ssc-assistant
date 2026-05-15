import { test, expect } from './fixtures/playground';

const PLAYGROUND_DISCLAIMER_STORAGE_KEY = 'playground_disclaimer_state_v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Verify disclaimer flow appears in sequence and can be accepted end-to-end.
 */
test('shows assistant then BR disclaimer and closes after acceptance', async ({ playground }) => {
  await playground.goto({ acceptDisclaimers: false });

  await expect(playground.disclaimerDialog()).toBeVisible();
  await expect(playground.disclaimerAcceptButton()).toBeVisible();

  await playground.disclaimerAcceptButton().click();
  await expect(playground.disclaimerDialog()).toBeVisible();
  await expect(playground.disclaimerAcceptButton()).toBeVisible();

  await playground.disclaimerAcceptButton().click();
  await expect(playground.disclaimerDialog()).toBeHidden();
});

/**
 * Verify disclaimer language toggle updates labels, including English label in FR mode.
 */
test('updates disclaimer labels when switching language', async ({ playground }) => {
  await playground.goto({ acceptDisclaimers: false });

  const initialLanguageLabel = (await playground.disclaimerLanguageButton().innerText()).trim();
  const initialHeading = (await playground.disclaimerHeading().innerText()).trim();

  await expect(playground.disclaimerLanguageButton()).toHaveText(/FRAN.?AIS|ENGLISH/i);
  await playground.disclaimerLanguageButton().click();

  await expect(playground.disclaimerLanguageButton()).toHaveText(/FRAN.?AIS|ENGLISH/i);

  const updatedLanguageLabel = (await playground.disclaimerLanguageButton().innerText()).trim();
  const updatedHeading = (await playground.disclaimerHeading().innerText()).trim();

  expect(updatedLanguageLabel.toUpperCase()).not.toBe(initialLanguageLabel.toUpperCase());
  expect(updatedHeading).not.toBe(initialHeading);
});

/**
 * Verify disclaimer is suppressed when both acceptances are within 30 days.
 */
test('suppresses disclaimer when accepted within 30 days', async ({ playground }) => {
  const acceptedAt = Date.now() - (THIRTY_DAYS_MS - 60_000);

  await playground.page.addInitScript(
    ([storageKey, timestamp]) => {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          assistantAcceptedAt: timestamp,
          brAcceptedAt: timestamp,
        }),
      );
    },
    [PLAYGROUND_DISCLAIMER_STORAGE_KEY, acceptedAt] as const,
  );

  await playground.goto({ preserveDisclaimerState: true });
  await expect(playground.disclaimerDialog()).toBeHidden();
});
