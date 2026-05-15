import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const PLAYGROUND_DISCLAIMER_STORAGE_KEY = 'playground_disclaimer_state_v1';

interface GotoOptions {
  acceptDisclaimers?: boolean;
  preserveDisclaimerState?: boolean;
}

/**
 * Lightweight page object for the Playwright playground entrypoint.
 */
export class PlaygroundPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Navigate to the playground route and wait for the shell to stabilize.
   */
  async goto(options: GotoOptions = {}): Promise<void> {
    const {
      acceptDisclaimers = true,
      preserveDisclaimerState = false,
    } = options;
    const now = Date.now();

    if (!preserveDisclaimerState) {
      await this.page.addInitScript(
        ([storageKey, shouldAccept, acceptedAt]) => {
          if (!shouldAccept) {
            localStorage.removeItem(storageKey);
            return;
          }

          localStorage.setItem(
            storageKey,
            JSON.stringify({
              assistantAcceptedAt: acceptedAt,
              brAcceptedAt: acceptedAt,
            }),
          );
        },
        [PLAYGROUND_DISCLAIMER_STORAGE_KEY, acceptDisclaimers, now] as const,
      );
    }

    await this.page.goto('/playground.e2e.html');
    await expect(this.sidebarToggle()).toBeVisible();
  }

  /**
   * Return the currently-visible disclaimer dialog (if any).
   */
  disclaimerDialog(): Locator {
    return this.page.getByRole('dialog');
  }

  /**
   * Return the disclaimer accept button.
   */
  disclaimerAcceptButton(): Locator {
    return this.page.locator('#playground-accept-disclaimer-button');
  }

  /**
   * Return the disclaimer language toggle button.
   */
  disclaimerLanguageButton(): Locator {
    return this.page.locator('#playground-disclaimer-language-button');
  }

  /**
   * Return the visible disclaimer heading.
   */
  disclaimerHeading(): Locator {
    return this.page.locator('#playground-disclaimer-title');
  }

  /**
   * Accept all currently-required disclaimers (assistant then BR).
   */
  async acceptAllDisclaimersIfVisible(maxAccepts = 2): Promise<void> {
    for (let accepts = 0; accepts < maxAccepts; accepts += 1) {
      const isVisible = await this.disclaimerAcceptButton().isVisible();
      if (!isVisible) {
        break;
      }

      await this.disclaimerAcceptButton().click();
    }
  }

  /**
   * Return the main chat session navigation region.
   */
  sessionNavigation(): Locator {
    return this.page.getByRole('navigation', { name: 'Chat sessions' });
  }

  /**
   * Return the mobile-only close button for the session drawer.
   */
  sessionNavigationCloseButton(): Locator {
    return this.page.getByRole('button', { name: 'Close chat sessions' });
  }

  /**
   * Open the session navigation when it is tucked behind the mobile drawer.
   */
  async openSessionNavigation(): Promise<void> {
    if (await this.sessionNavigation().isVisible()) {
      return;
    }

    await this.sidebarToggle().click();
    await expect(this.sessionNavigation()).toBeVisible();
  }

  /**
   * Close the mobile session drawer when it remains open after a sidebar action.
   */
  async closeSessionNavigationIfNeeded(): Promise<void> {
    if (!(await this.sessionNavigationCloseButton().isVisible())) {
      return;
    }

    await this.sessionNavigationCloseButton().click();
    await expect(this.sessionNavigation()).toBeHidden();
  }

  /**
   * Return the chat composer textarea.
   */
  composer(): Locator {
    return this.page.locator('#playground-ask-question');
  }

  /**
   * Return all suggestion buttons currently rendered in the empty state.
   */
  suggestionCards(): Locator {
    return this.page.locator('[aria-label="Suggested prompts"] button');
  }

  /**
   * Return the top-bar sidebar toggle button in whichever state it is currently showing.
   */
  sidebarToggle(): Locator {
    return this.page.locator('#playground-open-sidebar-button');
  }

  /**
   * Start a new chat session from the sidebar.
   */
  async startNewChat(): Promise<void> {
    await this.openSessionNavigation();
    await this.page.getByRole('button', { name: 'New' }).click();
    await this.closeSessionNavigationIfNeeded();
    await expect(this.composer()).toBeVisible();
  }

  /**
   * Send a user prompt through the composer.
   */
  async sendMessage(message: string): Promise<void> {
    await this.composer().click();
    await this.composer().fill(message);
    await expect(this.composer()).toHaveValue(message);
    await expect(this.page.getByLabel('Send')).toBeEnabled();
    await this.page.getByLabel('Send').click();
  }

  /**
   * Click one of the visible empty-state suggestion cards.
   */
  async chooseSuggestion(index = 0): Promise<void> {
    await this.suggestionCards().nth(index).click();
  }

  /**
   * Click a specific visible suggestion card by its accessible label.
   */
  async chooseSuggestionByText(text: string): Promise<void> {
    await this.page.getByRole('button', { name: text, exact: true }).click();
  }

  /**
   * Attach files through the hidden input used by the playground composer.
   */
  async attachFiles(files: Parameters<Locator['setInputFiles']>[0]): Promise<void> {
    await this.page.locator('input[type="file"]').first().setInputFiles(files);
  }

  /**
   * Open the overflow menu for one named session.
   */
  async openSessionOptions(sessionName: string): Promise<void> {
    await this.openSessionNavigation();
    const sessionRow = this.page.getByRole('listitem').filter({ hasText: sessionName });
    await sessionRow.getByRole('button', { name: 'Options', exact: true }).click();
  }

  /**
   * Select one visible session by name.
   */
  async selectSession(sessionName: string): Promise<void> {
    await this.openSessionNavigation();
    await this.page.getByRole('button', { name: sessionName }).click();
    await this.closeSessionNavigationIfNeeded();
  }

  /**
   * Hover an assistant response so desktop-only action buttons become visible.
   */
  async hoverAssistantResponse(text: string): Promise<void> {
    await this.page.getByText(text, { exact: false }).hover();
  }
}