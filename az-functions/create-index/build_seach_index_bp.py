import json  # bourne
import logging
import os
from functools import lru_cache
import re
import time
from typing import Any

import azure.durable_functions as df
from azure.core.credentials import AzureKeyCredential
from azure.core.exceptions import HttpResponseError
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.indexes.models import SearchAlias
from azure.storage.blob import BlobServiceClient
from bs4 import BeautifulSoup
from dotenv import load_dotenv
from utils.get_download_stats import get_latest_date

# Example for durable blueprint functions:
# https://github.com/Azure/azure-functions-durable-python/blob/dev/samples-v2/blueprint/durable_blueprints.py
build_index_bp = df.Blueprint()

# Configure environment variables
load_dotenv()
azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2025-01-01-preview")
api_search_version      = os.getenv("AZURE_SEARCH_VERSION", "2026-05-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
alias_index_name: str   = os.getenv("ALIAS_INDEX_NAME", "current")
default_retained_index_count = os.getenv("INDEX_CLEANUP_KEEP_COUNT", "10")
index_cleanup_delete_delay_seconds = os.getenv("INDEX_CLEANUP_DELETE_DELAY_SECONDS", "2")
index_cleanup_delete_max_retries = os.getenv("INDEX_CLEANUP_DELETE_MAX_RETRIES", "6")

credential = AzureKeyCredential(key)
openai_deployment_name: str = os.getenv("OPENAI_DEPLOYMENT_NAME", "gpt-4")
openai_model: str = os.getenv("OPENAI_MODEL", "gpt-4o")
embedding_model: str = "text-embedding-ada-002"
container_name = "sscplus-index-data"
TIMESTAMPED_INDEX_NAME_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}$")


@lru_cache(maxsize=1)
def _get_blob_service_client():
    if not blob_connection_string:
        raise ValueError("BLOB_CONNECTION_STRING is missing or empty.")
    return BlobServiceClient.from_connection_string(str(blob_connection_string))


def _build_index_name(index_data_path: str) -> str:
    return index_data_path.replace("_", "-").replace(":", "-")


def _get_retained_index_count(value=None) -> int:
    raw_value = default_retained_index_count if value is None else value
    try:
        return max(0, int(raw_value))
    except (TypeError, ValueError):
        logging.warning(
            "Invalid retained index count '%s'. Falling back to default '%s'.",
            raw_value,
            default_retained_index_count,
        )
        return max(0, int(default_retained_index_count))


def _get_search_index_client() -> SearchIndexClient:
    return SearchIndexClient(
        endpoint=service_endpoint,
        credential=credential,
        api_version=api_search_version,
    )


def _get_float_setting(value, default_value: str) -> float:
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        logging.warning(
            "Invalid float setting '%s'. Falling back to default '%s'.",
            value,
            default_value,
        )
        return max(0.0, float(default_value))


def _get_int_setting(value, default_value: str) -> int:
    try:
        return max(1, int(value))
    except (TypeError, ValueError):
        logging.warning(
            "Invalid integer setting '%s'. Falling back to default '%s'.",
            value,
            default_value,
        )
        return max(1, int(default_value))


def _get_retry_after_seconds(exc: HttpResponseError):
    response = getattr(exc, "response", None)
    if response is None:
        return None

    retry_after = response.headers.get("Retry-After")
    if retry_after is None:
        return None

    try:
        return max(0.0, float(retry_after))
    except ValueError:
        return None


def _delete_index_with_backoff(index_client: SearchIndexClient, index_name: str):
    base_delay_seconds = _get_float_setting(
        index_cleanup_delete_delay_seconds,
        "2",
    )
    max_retries = _get_int_setting(index_cleanup_delete_max_retries, "6")

    for attempt in range(max_retries):
        try:
            index_client.delete_index(index_name)
            return
        except HttpResponseError as exc:
            status_code = getattr(exc, "status_code", None)
            if status_code != 429 or attempt == max_retries - 1:
                raise

            retry_after_seconds = _get_retry_after_seconds(exc)
            wait_seconds = retry_after_seconds
            if wait_seconds is None:
                wait_seconds = min(base_delay_seconds * (2 ** attempt), 60.0)

            logging.warning(
                "Azure AI Search throttled deletion of index '%s'. Retrying in %.1f seconds (attempt %s/%s).",
                index_name,
                wait_seconds,
                attempt + 1,
                max_retries,
            )
            time.sleep(wait_seconds)


def _get_cleanup_candidates(index_names, retained_index_count: int):
    matching_index_names = sorted(
        [name for name in index_names if TIMESTAMPED_INDEX_NAME_PATTERN.fullmatch(name)],
        reverse=True,
    )
    return matching_index_names[retained_index_count:]


@build_index_bp.orchestration_trigger(context_name="context")
def build_search_index(context: df.DurableOrchestrationContext):
    # Import heavy llama_index modules lazily so function discovery can complete at startup.
    from llama_index.core import Document, StorageContext, VectorStoreIndex
    from llama_index.core.settings import Settings
    from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
    from llama_index.llms.azure_openai import AzureOpenAI
    from llama_index.vector_stores.azureaisearch import (
        AzureAISearchVectorStore,
        IndexManagement,
    )

    container_client = _get_blob_service_client().get_container_client(container_name)

    index_client = _get_search_index_client()

    metadata_fields =   {
                            "title" : "title",
                            "langcode" : "langcode",
                            "nid" : "nid",
                            "date" : "date",
                            "type" : "type",
                            "url" : "url",
                        }

    index_data_path = get_latest_date(container_client=container_client)
    index_name = _build_index_name(index_data_path)

    vector_store = AzureAISearchVectorStore(
        search_or_index_client=index_client,
        filterable_metadata_field_keys=metadata_fields,
        index_name=index_name,
        index_management=IndexManagement.CREATE_IF_NOT_EXISTS,
        id_field_key="id",
        chunk_field_key="chunk",
        embedding_field_key="embedding",
        embedding_dimensionality=1536,
        metadata_string_field_key="metadata",
        doc_id_field_key="doc_id",
        vector_algorithm_type="hnsw",
        language_analyzer="en.microsoft" #would need to be specified on each of the fields, depending if fr or en:
        # https://learn.microsoft.com/en-us/azure/search/index-add-language-analyzers#how-to-specify-a-language-analyzer
    )

    pages_path = f"{index_data_path}/pages"
    pages = yield context.call_activity("get_pages_as_json", pages_path)

    documents = []
    for page in pages:
        # https://gpt-index.readthedocs.io/en/v0.6.34/how_to/customization/custom_documents.html
        document = Document(
            text=str(page["body"]).replace("\n", " "),
            metadata={ # type: ignore
                'title': page["title"],
                'langcode': page["langcode"],
                'nid': page["nid"],
                'date': page["date"],
                'type': page['type'],
                'url': page['url']
            }
        )
        documents.append(document)

    llm_class: Any = AzureOpenAI
    llm = llm_class(
        model=openai_model,
        deployment_name=openai_deployment_name,
        api_version=api_version,
        azure_endpoint=azure_openai_uri,
        api_key=api_key
    )

    embed_model = AzureOpenAIEmbedding(
        model=embedding_model,
        deployment_name=embedding_model,
        api_key=api_key,
        azure_endpoint=str(azure_openai_uri),
        api_version=api_version
    )

    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    Settings.llm = llm
    Settings.embed_model = embed_model

    VectorStoreIndex.from_documents(
        documents, storage_context=storage_context
    )

    return f"Index created: {index_name}."


@build_index_bp.orchestration_trigger(context_name="context")
def cleanup_old_search_indexes(context: df.DurableOrchestrationContext):
    payload = context.get_input() or {}
    retained_index_count = _get_retained_index_count(payload.get("retain_count"))

    cleanup_summary = yield context.call_activity(
        "delete_old_search_indexes",
        {"retain_count": retained_index_count},
    )
    return cleanup_summary


#Activity
@build_index_bp.activity_trigger(input_name="path")
def get_pages_as_json(path: str):
    pages = []

    container_client = _get_blob_service_client().get_container_client(container_name)
    blob_list = container_client.list_blobs(name_starts_with=path)

    ignore_selectors = ['div.comment-login-message', 'section.block-date-modified-block']

    for blob in blob_list:
        blob_client = container_client.get_blob_client(blob) # type: ignore
        # Download the blob data and decode it to string
        data = blob_client.download_blob().readall().decode('utf-8')
        if data is not None:
            raw = json.loads(data)
            if isinstance(raw, list) and raw:
                raw = raw[0] # sometimes the object is boxed into an array, not useful to us
            if isinstance(raw, dict):
                page = {}
                soup = BeautifulSoup(raw["body"], "html.parser")
                # remove useless tags like date modified and login blocks (see example in 336 parsed data vs non parsed)
                for selector in ignore_selectors:
                    for s in soup.select(selector):
                        s.decompose()

                page["body"] = ' '.join(soup.stripped_strings)
                page["title"] = str(raw["title"]).strip()
                page["url"] = str(raw["url"]).strip()
                # Note: this date sometimes arrives as plain text and sometimes as HTML.
                page["date"] = str(raw["date"]).strip()
                page["filename"] = blob_client.blob_name
                page["nid"] = str(raw['nid']).strip()
                page["langcode"] = str(raw['langcode']).strip()
                page["type"] = str(raw['type']).strip()

                pages.append(page)
    return pages


@build_index_bp.activity_trigger(input_name="payload")
def delete_old_search_indexes(payload):
    retained_index_count = _get_retained_index_count((payload or {}).get("retain_count"))
    index_client = _get_search_index_client()
    delete_delay_seconds = _get_float_setting(index_cleanup_delete_delay_seconds, "2")

    index_names = list(index_client.list_index_names())
    indexes_to_delete = _get_cleanup_candidates(index_names, retained_index_count)

    for index_position, index_name in enumerate(indexes_to_delete):
        logging.info("Deleting old Azure AI Search index '%s'.", index_name)
        _delete_index_with_backoff(index_client, index_name)

        if index_position < len(indexes_to_delete) - 1 and delete_delay_seconds > 0:
            time.sleep(delete_delay_seconds)

    cleanup_summary = {
        "retain_count": retained_index_count,
        "deleted_indexes": indexes_to_delete,
        "deleted_count": len(indexes_to_delete),
        "matched_count": len([name for name in index_names if TIMESTAMPED_INDEX_NAME_PATTERN.fullmatch(name)]),
    }
    logging.info("Search index cleanup summary: %s", cleanup_summary)
    return cleanup_summary

@build_index_bp.orchestration_trigger(context_name="context")
def update_current_index_alias(context: df.DurableOrchestrationContext):
    """ this function is used to create/update an alias that is always pointed to in the SSC-Assistant, in order
        to allow us to update the indexes in the backend without having to update the backend API code.
    """
    container_client = _get_blob_service_client().get_container_client(container_name)
    index_data_path = get_latest_date(container_client=container_client)
    index_name = _build_index_name(index_data_path)

    logging.info("Alias creation starting ...")
    new_alias = yield context.call_activity(name="update_index_alias", input_={"index_name": index_name, "alias_name": alias_index_name})
    logging.info("Alias creation finished ...")
    logging.info(new_alias)

#Activity
@build_index_bp.activity_trigger(input_name="payload")
def update_index_alias(payload):

    index_client = _get_search_index_client()
    logging.info("Inside Update Index Alias function, payload -> %s", payload)

    alias = SearchAlias(name=payload['alias_name'], indexes=[payload['index_name']])
    new_alias = index_client.create_or_update_alias(alias)
    logging.info(new_alias)

    return json.dumps(new_alias.as_dict())