import { test, expect } from "./fixtures/playground";

const suggestion = {
  success: true,
  language: "en",
  original_query: "What is SSC's content management system?",
  content: "The saved suggestion answer [doc1].",
  timestamp: "2026-11-09T12:00:00.000Z",
  requester: "mysscplus",
  citations: [
    { title: "Saved source", url: "https://example.com/source" },
    { title: "Additional source", url: "https://example.com/additional" },
  ],
};

test.beforeEach(async ({ page, playground }) => {
  // Serve the authenticated test entrypoint at production URLs without changing runtime auth.
  await page.route(/\/(suggest-callback|playground)(\?.*)?$/, async (route) => {
    if (!route.request().isNavigationRequest()) {
      await route.fallback();
      return;
    }
    const response = await page.request.get("/playground.e2e.html");
    await route.fulfill({ response });
  });
  await playground.goto();
});

test("imports a callback into the sidebar, renders citations, and survives refresh once", async ({
  page, playground, mockPlayground,
}) => {
  let requests = 0;
  await page.route("**/api/1.0/suggest?**", async (route) => {
    requests += 1;
    await route.fulfill({ json: suggestion });
  });
  await page.goto("/suggest-callback?suggestionContextId=4c279c1f-ca32-48ab-895f-d6b5beec7f41");
  await expect(page.getByRole("log")).toContainText(suggestion.original_query);
  await expect(page.getByRole("log")).toContainText("The saved suggestion answer");
  await expect(page.getByRole("button", { name: /Open citation details for Saved source/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open citation details for Additional source/ })).toBeVisible();
  await page.getByRole("button", { name: /Open citation details for Saved source/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await playground.openSessionNavigation();
  await expect(page.getByRole("button", { name: suggestion.original_query })).toBeVisible();
  await playground.selectSession(suggestion.original_query);

  const initialRequestCount = requests;
  await page.reload();
  await expect(page.getByRole("log")).toContainText("The saved suggestion answer");
  expect(requests).toBe(initialRequestCount);
  const imported = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("playground_chat_state") || "{}");
    return {
      sessions: state.sessions.sessions.filter(
        (session: { suggestionHandoffId?: string }) => session.suggestionHandoffId,
      ).length,
      messages: state.chat.messages.length,
    };
  });
  expect(imported).toEqual({ sessions: 1, messages: 2 });
  await mockPlayground.queueAssistantResponse({ text: "Follow-up response." });
  await playground.sendMessage("Tell me more.");
  await expect(page.getByRole("log")).toContainText("Follow-up response.");
});

test("opens French answers in French", async ({ page }) => {
  await page.route("**/api/1.0/suggest?**", async (route) => {
    await route.fulfill({
      json: {
        ...suggestion,
        language: "fr",
        original_query: "Quel est le système de gestion du contenu?",
        content: "Voici la réponse enregistrée [doc1].",
      },
    });
  });
  await page.goto("/suggest-callback?suggestionContextId=french-suggestion");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("log")).toContainText("Voici la réponse enregistrée");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("log")).toContainText("Voici la réponse enregistrée");
});

for (const kind of ["missing", "server", "validation", "network"]) {
  test(`shows a visible ${kind} callback error`, async ({ page }) => {
    await page.route("**/api/1.0/suggest?**", async (route) => {
      if (kind === "network") {
        await route.abort();
      } else {
        await route.fulfill({
          json: kind === "server" ? { success: false } : { success: true },
        });
      }
    });
    await page.goto(kind === "missing"
      ? "/suggest-callback"
      : "/suggest-callback?suggestionContextId=error-suggestion");
    await expect(page.getByRole("alert")).toContainText("Your suggestions have not been loaded.");
  });
}
