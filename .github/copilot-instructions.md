## AI agent guide for SSC Assistant

This repo implements a bilingual RAG assistant using Azure OpenAI + Azure Cognitive Search, a Python API (APIFlask) and a React/Vite frontend.

### Architecture and data flow
- UI (`app/frontend`) calls API (`app/api/app.py` → `v1/routes_v1.py`).
- RAG: `utils/openai.py::chat_with_data` builds messages (`utils/manage_message.py`) and calls Azure OpenAI; for RAG it sets `extra_body` with an Azure Search data source (index, embeddings, lang filter).
- Tools: dynamic function-calling via `src/service/tool_service.py` discovers `@tool_metadata` in `app/api/tools/**` and can influence search (e.g., return an `AzureCognitiveSearchDataSourceConfig`).
- Storage/telemetry: Azure Table Storage via `utils/db.py` stores requests/completions/feedback; file uploads go to Blob Storage via `utils.azure_clients`.
- Data ingestion: Azure Functions in `az-functions/create-index` generate Azure Search indices; infra in `terraform/`.

Key files and directories
- API entry/config: `app/api/app.py` (APIFlask, servers, ApiKey auth), `app/api/v1/routes_v1.py` (endpoints incl. `/completion/chat`, `/completion/chat/stream` multipart, `/suggest`, `/upload`, stats reports).
- OpenAI + RAG: `app/api/utils/openai.py`, `app/api/utils/manage_message.py` (system prompts per tool + LaTeX fragment), `app/api/utils/models.py` (dataclass API models + Pydantic search config).
- Tools: `app/api/src/constants/tools.py`, `app/api/src/service/tool_service.py`, `app/api/tools/*/*_functions.py` (e.g., `tools/geds/geds_functions.py`).
- Persistence/context: `app/api/utils/db.py`, `app/api/src/context/build_context.py` (wires SQL + table storage + services).
- Frontend: `app/frontend` (Vite, MSAL, feature flags in `.env`).

Runtime and environment
- Auth: API uses header `X-API-Key` (see `app.py security_schemes`) and AAD user context (`utils/auth.py`, `user_ad`).
- Azure identity: local dev requires `az login --use-device-code` so `DefaultAzureCredential` works for Table/Blob/OpenAI.
- Required env (API): `AZURE_OPENAI_ENDPOINT`, `AZURE_SEARCH_SERVICE_ENDPOINT`, `AZURE_SEARCH_ADMIN_KEY`, `DATABASE_ENDPOINT`, `BLOB_ENDPOINT`, `SQL_CONNECTION_STRING`, optional `ALLOWED_TOOLS`.
- Frontend flags: `.env` uses `VITE_ALLOWED_TOOLS` and `VITE_DISABLED_FEATURES` (see `app/frontend/README.md`).

Developer workflows (concrete)
- API (local): `cd app/api`, create venv (`uv venv`), `source .venv/bin/activate`, `uv pip sync requirements-dev.txt`, run `flask --debug run --port=5001`.
- DB migrations: `alembic` from `app/api` (see `app/api/README.md`); set `SQL_CONNECTION_STRING` first.
- Frontend: `cd app/frontend && npm run dev` (Vite + `server.js` proxy, MSAL configured in env).
- Functions: follow `az-functions/create-index/README.md` for `.env`, `local.settings.json`, deps, and triggers.
- Infra: `cd terraform && terraform init && terraform plan -var-file=secret.tfvars` (see `terraform/README.md`).
- Tests: API unit tests in `app/api/src/service/*_test*.py` run with `pytest`; frontend tests via `npm test` (vitest).

Project conventions and patterns
- Messages: built in `manage_message.load_messages` with per-tool system prompts (archibus/bits/pmcoe) and a LaTeX formatting note appended to system.
- Streaming: `/completion/chat/stream` returns `multipart/x-mixed-replace` with boundary `GPT-Interaction` (first text, then JSON payload).
- Tools: add functions with `@tool_metadata` in `app/api/tools/<tool>/<tool>_functions.py`; constants in `src/constants/tools.py`; allow via `ALLOWED_TOOLS`; optional aggregation in `ToolService._process_*` to enrich `tools_info` in responses.
- PMCOE quirk: `build_completion_response` rewrites missing citation URLs when tool type is `pmcoe` (language-based path).

When adding features
- New endpoint: put in `v1/routes_v1.py`, model with `marshmallow_dataclass` in `utils/models.py`, store events via `utils/db.py`.
- New tool: follow “Tools” above; return either plain data or a JSON compatible with `AzureCognitiveSearchDataSourceConfig` to steer RAG.
- New index/data source: update the Function app templates and ensure `vectorSearch` profiles and `semantic` config match usage.

Need clarity? Tell us where these instructions feel thin (e.g., exact pytest config, MSAL settings, or Function deployment), and we’ll tighten this file.
