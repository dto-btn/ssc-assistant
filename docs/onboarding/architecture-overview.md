# SSC Assistant Architecture Overview (Onboarding)

Last updated: 2026-08-04

This document explains, at a high level, how the current SSC Assistant architecture works, including:

- The legacy system (main chat path)
- The newer Playground system
- Shared dependencies (Azure services, storage, auth)
- External integrations (LiteLLM, MCP servers, Archibus)

It is based on current code paths, not only README descriptions.

## 1) System Context (Old + New)

```mermaid
flowchart LR
  User[User Browser]

  subgraph Frontend[app/frontend]
   LegacyUI[Legacy Chat UI<br/>Route: /]
   PlaygroundUI[Playground UI<br/>Route: /playground]
   Msal[MSAL + Entra auth in browser]
  end

  subgraph API[app/api APIFlask]
   V1[V1 routes<br/>/api/1.0/*]
   PlayAPI[Playground routes<br/>/api/playground/*]
   AzureProxy[AOAI Proxy<br/>/proxy/azure/*]
   ToolSvc[ToolService + tool discovery]
   MsgBuild[Message builder]
  end

  subgraph Azure[Azure Managed Services]
   AOAI[Azure OpenAI]
   Search[Azure Cognitive Search]
   Blob[Blob Storage]
   Table[Table Storage]
   AAD[Entra ID token validation]
  end

  subgraph External[External or Adjacent Services]
   LiteLLM[Standalone LiteLLM Proxy]
   Orchestrator[Orchestrator MCP]
   DomainMCP[Domain MCP Servers<br/>PMCOE/BITS/etc]
   Archibus[Archibus API]
  end

  User --> LegacyUI
  User --> PlaygroundUI
  LegacyUI --> Msal
  PlaygroundUI --> Msal

  LegacyUI -->|chat stream + feedback + upload| V1
  PlaygroundUI -->|file/session/feedback APIs| PlayAPI

  V1 --> ToolSvc
  V1 --> MsgBuild
  V1 --> AOAI
  V1 --> Search
  V1 --> Blob
  V1 --> Table
  V1 --> Archibus

  PlayAPI --> Blob
  PlayAPI --> Table

  PlaygroundUI -->|OpenAI Responses API calls| LiteLLM
  PlaygroundUI -->|preflight route suggestion| Orchestrator
  PlaygroundUI -->|tool execution in model run| DomainMCP

  AzureProxy --> AOAI
  V1 --> AAD
  PlayAPI --> AAD
  AzureProxy --> AAD
```

## 2) Legacy Flow (Current Production-Like Path)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant FE as Legacy Frontend (/)
  participant API as /api/1.0/completion/chat/stream
  participant TS as ToolService
  participant AOAI as Azure OpenAI
  participant ACS as Azure Cognitive Search
  participant TBL as Azure Table Storage
  participant BLOB as Azure Blob Storage

  U->>FE: Ask question
  FE->>API: POST message request + Bearer token
  API->>TBL: Store request metadata (async thread)
  API->>TS: Load requested tools (@tool_metadata discovered)
  TS-->>API: Tool calls + optional search config payload
  API->>AOAI: Chat completion (may include tool loop)
  API->>ACS: RAG via extra_body azure_search data source (when configured)
  AOAI-->>API: Streamed answer chunks + context/citations
  API-->>FE: multipart stream (text then JSON payload)
  API->>TBL: Store completion metadata (async thread)
  FE->>API: Optional /feedback
  FE->>API: Optional /upload
  API->>BLOB: Save uploaded attachment
```

Notes:

- Legacy frontend chat calls `/api/1.0/completion/chat/stream` and parses the multipart boundary `GPT-Interaction`.
- Tool responses can alter retrieval configuration by returning an `AzureCognitiveSearchDataSourceConfig` shape.
- Legacy telemetry persistence is primarily Azure Table Storage (`chat`, `feedback`, `flagged`, `suggest`).

## 3) Playground Flow (New System)

```mermaid
sequenceDiagram
  autonumber
  participant U as User
  participant PFE as Playground Frontend (/playground)
  participant O as Orchestrator MCP
  participant L as Standalone LiteLLM
  participant M as Routed MCP Servers
  participant PAPI as /api/playground/*
  participant B as Blob Storage
  participant T as Table Storage

  U->>PFE: Ask question
  PFE->>O: Optional preflight classification/routing
  O-->>PFE: Recommended MCP targets
  PFE->>L: Responses API request (model + tools=MCP servers)
  L->>M: MCP tool calls as needed
  M-->>L: Tool outputs/citations
  L-->>PFE: Streamed response events + final output
  PFE->>PAPI: Upload/list/extract/rename/delete session files
  PAPI->>B: Store/read blobs under per-user oid prefix
  PFE->>PAPI: Submit playground feedback
  PAPI->>T: Persist feedback via shared db utility
```

Notes:

- Playground completion path is currently frontend -> standalone LiteLLM directly.
- Playground API routes are used for file/session lifecycle and feedback, not for chat generation.
- Orchestrator and downstream MCP selection are controlled by client config (`VITE_MCP_SERVERS`) and preflight logic.

## 4) How Old and New Systems Are "Fused"

Both systems coexist in one repo and one frontend app:

- Same web app, different routes:
  - Legacy UI at `/`
  - Playground UI at `/playground` (feature-flag controlled)
- Same backend process (`app/api/app.py`) hosts:
  - Legacy v1 API routes
  - Playground file/session routes
  - AOAI proxy routes (`/proxy/azure/*`)
- Shared auth model:
  - Entra access token validation (`Authorization: Bearer`)
  - API key role checks where configured (`X-API-Key`)
- Shared storage/utilities:
  - Blob and Table helpers are reused across old/new endpoints.

## 5) External Service Interactions to Account For

These are the major service boundaries for architecture discussions:

- Azure OpenAI (legacy chat, plus optional AOAI proxy path)
- Azure Cognitive Search (legacy RAG retrieval)
- Azure Blob Storage (legacy uploads and playground file/session artifacts)
- Azure Table Storage (chat logs, suggestions, feedback, flags)
- Standalone LiteLLM proxy (playground completion runtime)
- MCP servers (orchestrator + domain servers used by playground)
- Archibus API (legacy booking workflow)

## 6) Current Gaps / Drift to Be Aware Of

Observed architecture drift:

- `app/api/README.md` describes embedded LiteLLM endpoints (`/proxy/litellm/*`),
 but current `app/api/proxy` code exports only Azure proxy routes (`/proxy/azure/*`).
- Frontend playground README and provider code indicate standalone LiteLLM usage.

This likely means LiteLLM strategy has shifted and docs need consolidation.

## 7) Practical File Map (Where To Start Reading)

- Backend entrypoint: `app/api/app.py`
- Legacy chat routes: `app/api/v1/routes_v1.py`
- Legacy AOAI + RAG logic: `app/api/utils/openai.py`
- Tool discovery/execution: `app/api/src/service/tool_service.py`
- Playground backend routes: `app/api/playground/routes_playground.py`
- AOAI proxy route: `app/api/proxy/azure.py`
- Frontend route split: `app/frontend/src/routes/AppRoutes.tsx`
- Legacy chat API client: `app/frontend/src/api/api.ts`
- Playground provider (LiteLLM): `app/frontend/src/playground/services/providers/azureOpenAIProvider.ts`
- Orchestrator integration: `app/frontend/src/playground/services/orchestratorService.ts`

## 8) Suggested Follow-up (Onboarding FAQ Draft)

Next, we can build a developer onboarding FAQ around questions like:

1. Which path should I extend: legacy (`/api/1.0`) or playground?
2. Where is the real source of truth for model routing now: AOAI proxy or LiteLLM?
3. How are MCP servers configured and safely validated?
4. Where are citations produced, transformed, and displayed in each path?
5. How does auth differ between frontend, API, and MCP hops?
6. What data is persisted, where, and under which retention model?
7. What is the migration target: keep both systems or converge on one?
