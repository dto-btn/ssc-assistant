# Frontend Test Coverage

This directory currently documents the Playwright end-to-end coverage for the playground experience at `/playground`.

## Current E2E Coverage

- `e2e/playground-shell.spec.ts`: verifies the playground shell renders, a new chat can be created, and the desktop sidebar toggle works.
- `e2e/playground-chat.spec.ts`: verifies typed prompts, suggestion-card prompts, regenerate, copy, feedback, and stop-generation behavior.
- `e2e/playground-session.spec.ts`: verifies archived session rehydration, rename/delete flows, and attachment handling for supported and unsupported files.
- `e2e/playground-mobile.spec.ts`: verifies the mobile session drawer flow and session switching on narrow viewports.

## Shared Test Infrastructure

- `e2e/fixtures/mockPlayground.ts`: deterministic browser-level mocks for playground API requests, feedback, uploads, archived sessions, and streamed assistant responses. It supports "persistent responses" to test error handling across multiple retries.
- `e2e/fixtures/playground.ts`: shared Playwright fixtures that wire the mock layer and page object into each test.
- `e2e/pages/PlaygroundPage.ts`: page object used by the specs for common playground interactions.

## Auth Setup

Playwright uses a dedicated test entrypoint instead of branching through the normal runtime auth flow.

- **Entrypoint**: `playground.e2e.html` renders the playground directly for the E2E harness.
- **Token**: Set `PLAYWRIGHT_E2E_ACCESS_TOKEN` before running Playwright. The config passes it through as `VITE_E2E_ACCESS_TOKEN` to seed the playground store.
- **Scope**: This token path exists only in the Playwright entrypoint and does not change the normal MSAL-backed application flow.

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
export PLAYWRIGHT_E2E_ACCESS_TOKEN="$(node -e 'const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url"); process.stdout.write(`${encode({ alg: "HS256", typ: "JWT" })}.${encode({ exp: 4102444800, name: "playwright-e2e-token" })}.signature`)')"
npm run test:e2e
# OR directly via playwright
npx playwright test
```

Run a specific spec file:

```sh
npx playwright test tests/e2e/playground-chat.spec.ts
```

Run one test by name:

```sh
npx playwright test -g "supports copy and feedback actions on assistant responses"
```

Run a specific project/browser:

```sh
npx playwright test --project=chromium
npx playwright test tests/e2e/playground-mobile.spec.ts --project="Mobile Safari"
```

Useful combinations:

```sh
# One spec in one browser
npx playwright test tests/e2e/playground-session.spec.ts --project=firefox

# One named test in headed mode
npx playwright test -g "streams typed prompts into assistant messages" --headed
```

Watch the browser while the test runs:

```sh
# Open a visible browser window during the run
npx playwright test --headed

# Open the Playwright inspector and step through the test interactively
npx playwright test --debug
```