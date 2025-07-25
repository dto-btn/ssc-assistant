# Copilot & AI Agent Coding Instructions for SSC Assistant

## Project Overview
- **SSC Assistant** is a Retrieval Augmented Generation (RAG) chatbot for Shared Services Canada, leveraging Azure OpenAI (GPT-4o) and Azure Cognitive Search.
- The backend is Python (Flask API in `app/api`), the frontend is React/TypeScript (`app/frontend`).
- Azure Functions in `az-functions/create-index` handle data transformation and indexing for search.
- Infrastructure is managed via Terraform (`terraform/`).

## Architecture & Data Flow
- User interacts with the React frontend, which calls the Flask API.
- The API uses Azure OpenAI for language tasks and Azure Cognitive Search for document retrieval.
- Data is indexed via Azure Functions, which process raw data and push to Azure Search.
- Attachments (e.g., files) are stored in Azure Blob Storage, referenced in API models.

## Key Patterns & Conventions
- **API Models:** Defined in `app/api/utils/models.py` using `@dataclass` and Pydantic for validation.
- **System Prompts:** Centralized in `app/api/utils/manage_message.py` for both English and French.
- **Tool Integration:** Tools (e.g., GEDS, PMCOE) are managed via `src/service/tool_service.py` and referenced in API responses.
- **Environment Variables:** All Azure endpoints, keys, and config are loaded from environment variables or `.env` files (see `az-functions/create-index/README.md`).
- **Language Support:** Prompts and UI support both English and French; see `manage_message.py` and frontend i18n files.
- **Testing/Dev:** Use Dev Containers or Codespaces for consistent environments. See `README.md` for setup.
- **Manual API Start:** `cd app/api && flask run --debug --port=5001`
- **Manual Frontend Start:** `cd app/frontend && npm run dev`

## Developer Workflows
- **Azure Login:** Always run `az login --use-device-code` before local dev.
- **Terraform:** `cd terraform && terraform init && terraform plan -var-file="secret.tfvars"`
- **Azure Functions:** Activate venv, install requirements, and deploy as per `az-functions/create-index/README.md`.
- **Account Permissions:** Use a `@163dev.onmicrosoft.com` account for dev/test (see `README.md`).

## Integration Points
- **Azure OpenAI**: Used for all LLM tasks (see `openai.py`).
- **Azure Cognitive Search**: Used for RAG (see `openai.py`, `az-functions/create-index`).
- **Blob Storage**: Attachments referenced in API models, uploaded via API endpoints.
- **External Tools**: GEDS, PMCOE, and others integrated as "tools" in API responses.

## Project-Specific Advice
- Always reference attachments by their blob storage URL, not by file name.
- When adding new tools, update `src/service/tool_service.py` and ensure proper registration in API responses.
- For new data sources, update Azure Function indexers and ensure schema matches search requirements.
- Use centralized prompts and follow the bilingual pattern for all user-facing text.

---

If any section is unclear or missing, please provide feedback for further refinement.
