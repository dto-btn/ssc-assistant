import logging
import os
from dataclasses import dataclass

from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import AzureError
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.models import VectorizedQuery
from openai import AzureOpenAI, OpenAIError

from src.constants.tools import TOOL_CORPORATE
from utils.models import Citation, Context, SearchSourceConfig

logger = logging.getLogger(__name__)
SEARCH_API_VERSION = "2026-10-01"
MAX_PASSAGE_CHARS = 4_000
MAX_CONTEXT_CHARS = 48_000


class SearchRetrievalError(RuntimeError):
    """The selected search source could not be queried."""


@dataclass(frozen=True)
class SearchFields:
    vector: str
    content: str
    title: str | None
    url: str | None
    dimensions: int
    semantic_configuration: str | None = None


def _search_fields(
    endpoint: str, credential: AzureKeyCredential, source: SearchSourceConfig, tool_type: str
) -> SearchFields:
    if tool_type == TOOL_CORPORATE:
        return SearchFields("embedding", "chunk", "title", "url", 1536)

    with SearchIndexClient(endpoint, credential, api_version=SEARCH_API_VERSION) as index_client:
        index = index_client.get_index(source.index_name)

    fields = {field.name: field for field in index.fields if field.hidden is not True}
    vectors = [field for field in index.fields if field.vector_search_dimensions]
    preferred = next((field for field in vectors if field.name == "text_vector"), None)
    vector = preferred or (vectors[0] if len(vectors) == 1 else None)
    semantic = None
    if index.semantic_search:
        configurations = index.semantic_search.configurations or []
        semantic = next(
            (config for config in configurations if config.name == index.semantic_search.default_configuration_name),
            configurations[0] if len(configurations) == 1 else None,
        )
    semantic_fields = semantic.prioritized_fields if semantic else None
    content_names = [field.field_name for field in (semantic_fields.content_fields or [])] if semantic_fields else []
    title_names = ["title", "metadata_storage_name"]
    if semantic_fields and semantic_fields.title_field:
        title_names.insert(0, semantic_fields.title_field.field_name)
    content = next((name for name in [*content_names, "chunk", "content", "text"] if name in fields), None)
    title = next((name for name in title_names if name in fields), None)
    if not vector or not vector.vector_search_dimensions or not content:
        logger.error("Missing or ambiguous vector/content fields for search index %s", source.index_name)
        raise SearchRetrievalError("The search index schema does not support grounding.")
    if source.query_type == "vector_semantic_hybrid" and not semantic:
        logger.error("No default or unique semantic configuration for search index %s", source.index_name)
        raise SearchRetrievalError("The search index has no usable semantic configuration.")

    return SearchFields(
        vector.name, content, title, "url" if "url" in fields else None,
        vector.vector_search_dimensions, semantic.name if semantic else None,
    )


def retrieve_context(
    client: AzureOpenAI, source: SearchSourceConfig, tool_type: str, query: str, lang: str
) -> Context:
    endpoint = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT")
    key = os.getenv("AZURE_SEARCH_ADMIN_KEY")
    if not endpoint or not key:
        logger.error("Missing Azure AI Search endpoint or credential")
        raise SearchRetrievalError("Azure AI Search is not configured.")

    credential = AzureKeyCredential(key)
    citations: list[Citation] = []
    remaining_chars = MAX_CONTEXT_CHARS
    lang_filter = f"langcode eq '{lang}'" if source.use_language_filter and lang in ("en", "fr") else None
    try:
        fields = _search_fields(endpoint, credential, source, tool_type)
        if source.embedding_model == "text-embedding-ada-002":
            embedding = client.embeddings.create(model=source.embedding_model, input=query)
        else:
            embedding = client.embeddings.create(
                model=source.embedding_model, input=query, dimensions=fields.dimensions
            )
        vector = embedding.data[0].embedding if embedding.data else []
        if len(vector) != fields.dimensions:
            logger.error("Embedding dimensions do not match search index %s", source.index_name)
            raise SearchRetrievalError("The query embedding does not match the search index.")
        semantic = source.query_type == "vector_semantic_hybrid"
        with SearchClient(endpoint, source.index_name, credential, api_version=SEARCH_API_VERSION) as search_client:
            results = search_client.search(
                search_text=query,
                vector_queries=[VectorizedQuery(vector=vector, fields=fields.vector, k_nearest_neighbors=50)],
                filter=lang_filter,
                top=source.top_n_documents,
                select=list(dict.fromkeys(field for field in (fields.content, fields.title, fields.url) if field)),
                query_type="semantic" if semantic else "simple",
                semantic_configuration_name=fields.semantic_configuration if semantic else None,
            )
            for hit in results:
                content = hit.get(fields.content)
                if not isinstance(content, str) or not content.strip():
                    continue
                title = hit.get(fields.title) if fields.title else None
                url = hit.get(fields.url) if fields.url else None
                passage = content.strip()[:min(MAX_PASSAGE_CHARS, remaining_chars)]
                citations.append(Citation(content=passage, title=title or "", url=url or ""))
                remaining_chars -= len(passage)
                if remaining_chars <= 0:
                    break
    except (AzureError, OpenAIError) as exc:
        logger.error(
            "Grounding retrieval failed for index %s (%s, status=%s)",
            source.index_name, type(exc).__name__, getattr(exc, "status_code", None),
        )
        raise SearchRetrievalError("Azure AI Search retrieval failed.") from exc

    return Context(role="tool", citations=citations, intent=[query])
