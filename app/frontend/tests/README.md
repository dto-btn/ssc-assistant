# Frontend Test Coverage

This directory currently documents the Playwright end-to-end coverage for the playground experience at `/playground`.

## Current E2E Coverage

- `e2e/playground-shell.spec.ts`: verifies the playground shell renders, a new chat can be created, and the desktop sidebar toggle works.
- `e2e/playground-chat.spec.ts`: verifies typed prompts, suggestion-card prompts, regenerate, copy, feedback, and stop-generation behavior.
- `e2e/playground-session.spec.ts`: verifies archived session rehydration, rename/delete flows, and attachment handling for supported and unsupported files.
- `e2e/playground-mobile.spec.ts`: verifies the mobile session drawer flow and session switching on narrow viewports.

## Shared Test Infrastructure

- `e2e/fixtures/mockPlayground.ts`: deterministic browser-level mocks for auth bypass, playground API requests, feedback, uploads, archived sessions, and streamed assistant responses. It supports "persistent responses" to test error handling across multiple retries.
- `e2e/fixtures/playground.ts`: shared Playwright fixtures that wire the mock layer and page object into each test.
- `e2e/pages/PlaygroundPage.ts`: page object used by the specs for common playground interactions.

## Auth Bypass and Security

To facilitate testing without a live MSAL flow, the application supports an E2E auth bypass.

- **Enable**: Set `VITE_E2E_BYPASS_AUTH=true` in the environment.
- **Scope**: The bypass is strictly limited to `DEV` environments where the URL path starts with `/playground`.
- **Mechanism**: Forces the frontend to skip MSAL redirects and injects a mock bearer token into all API requests within the playground context.

## Browser Coverage

The suite runs against:

- Chromium
- Firefox
- WebKit
- Mobile Chrome (`Pixel 5`)
- Mobile Safari (`iPhone 12`)

## Run

From `app/frontend`:

```sh
npm run test:e2e
# OR directly via playwright
npx playwright test
```