# Playground Mental Model and Folder Guide

Last updated: 2026-08-04

This guide gives a quick way to understand how the Playground frontend and API playground are organized, and how component code connects to client API code.

## 1) Diagrams to Open

Open these Mermaid files in VS Code and run Mermaid preview:

- `docs/onboarding/diagrams/playground-flow.mmd`
- `docs/onboarding/diagrams/frontend-playground-structure.mmd`
- `docs/onboarding/diagrams/api-playground-structure.mmd`

What each diagram answers:

- `playground-flow.mmd`: "If a user sends a message, where does it go next?"
- `frontend-playground-structure.mmd`: "How is `app/frontend/src/playground` split by responsibility?"
- `api-playground-structure.mmd`: "What does `app/api/playground` expose and where does data go?"

## 2) End-to-End Mental Model (Plain English)

1. Route and shell:
   - `/playground` route renders `Playground.tsx`, which installs Playground-specific providers (Redux store + theme).
   - `PlaygroundRoot.tsx` composes `SessionSidebar` and `ChatArea`.

2. User sends a message:
   - `ChatInput.tsx` dispatches `sendAssistantMessage` (a thunk).
   - `assistantThunks.ts` orchestrates routing and completion.

3. Tool/server routing:
   - `orchestratorService.ts` can recommend MCP servers for the current request.
   - Routed tools are passed into completion execution.

4. Model call:
   - `completionService.ts` delegates to `providers/azureOpenAIProvider.ts`.
   - Despite the filename, this provider currently talks to a LiteLLM/OpenAI-compatible endpoint configured for Playground.

5. Files and sessions:
   - Upload/list/extract/rename/delete run through `playground/api/storage.ts`.
   - Backend handlers live in `app/api/playground/routes_playground.py` and persist file/session metadata in Blob metadata.

6. Feedback:
   - Message feedback buttons call `feedbackThunks.ts` -> `playground/api/feedback.ts` -> `/api/playground/feedback`.

## 3) Why These Names Exist (Thunk, Slice, etc.)

These names come from Redux Toolkit patterns.

- **Slice**:
  - A "slice" is one domain of app state plus its reducers/actions.
  - Example: `chatSlice` manages chat messages and loading states.
  - Why the name: state is split into slices instead of one giant reducer.

- **Thunk**:
  - A thunk is async or multi-step logic that can dispatch many actions.
  - Example: `sendAssistantMessage` dispatches loading states, calls services, then updates messages.
  - Why not in a component: keeps UI components focused on rendering.

- **Reducer**:
  - Pure state transition function used by slices.
  - Receives current state + action, returns new state.

- **Selector**:
  - Read helper that computes or extracts state for components.
  - Keeps component code cleaner and avoids repeated lookup logic.

- **Middleware**:
  - Pipeline hook around dispatch.
  - In Playground: archiver/outbox middleware handle cross-cutting concerns.

## 4) Naming Oddities You Will Notice

- `azureOpenAIProvider.ts` currently behaves as a generic OpenAI-compatible provider for Playground and is often used with LiteLLM.
  - The filename reflects historical evolution, not strict current endpoint naming.

- `storage.ts` in Playground API client does more than storage:
  - It also handles session rename/delete and text extraction calls.
  - The module is effectively "file and session backend client".

- `sessionBootstrapThunks.ts` and `useSessionRehydration.ts` sound similar but are different layers:
  - `sessionBootstrapThunks.ts`: state-side orchestration.
  - `useSessionRehydration.ts`: component hook that decides when to invoke rehydration.

## 5) Frontend Playground Folder Reference

Root: `app/frontend/src/playground`

- `components/`: visual building blocks and interaction surfaces (chat area, sidebar, message row, input).
- `store/`: Redux setup, slices, selectors, middleware, and thunks.
- `services/`: orchestration/business logic for model routing and completion providers.
- `api/`: REST client wrappers for `/api/playground/*` endpoints.
- `hooks/`: composable behavior for UI/state lifecycle (rehydration, file attachments).
- `export/`: session export builders and format-specific download helpers.
- `utils/`: formatting and transformation utilities (citations, stream helpers, archive parsing).
- `constants/`, `constants.ts`, `types.ts`: shared constants and data contracts used across the module.
- `locales/`: playground-specific translation content.
- `theme/`, `theme.ts`: playground-scoped theming.
- `e2e/`, tests: playground-focused integration and behavior tests.

## 6) API Playground Folder Reference

Root: `app/api/playground`

- `routes_playground.py`:
  - Defines Playground endpoints for upload, session file listing, extraction, rename/delete, and feedback.
  - Handles auth checks, metadata normalization, and Blob/Table interactions.

- `test_routes_playground.py`:
  - Route-level tests for success/error paths and metadata semantics.

- `conftest.py`:
  - Shared pytest fixtures and test configuration for this module.

- `populate_test_sessions.py`:
  - Utility script to seed local test session artifacts.

## 7) Quick Read Path for New Engineers

If you have 30 minutes:

1. Open `docs/onboarding/diagrams/playground-flow.mmd`.
2. Read `app/frontend/src/playground/components/PlaygroundRoot.tsx`.
3. Read `app/frontend/src/playground/store/thunks/assistantThunks.ts`.
4. Read `app/frontend/src/playground/services/orchestratorService.ts`.
5. Read `app/frontend/src/playground/api/storage.ts`.
6. Read `app/api/playground/routes_playground.py`.

That sequence gives the fastest understanding of "UI action -> orchestration -> API/storage side effects".
