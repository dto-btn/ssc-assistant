import json
from unittest.mock import Mock, patch
from urllib.parse import unquote

import pytest
from azure.core.exceptions import ServiceRequestError
from azure.core.pipeline.transport import RequestsTransport, RequestsTransportResponse
from azure.search.documents.indexes.models import SearchIndex
from openai.types.chat import ChatCompletion
from requests import Response

from utils import openai as chat
from utils.models import MessageRequest, SearchSourceConfig, ToolInfo
from utils.search import SearchRetrievalError, retrieve_context


@pytest.fixture
def fake_openai(monkeypatch):
    monkeypatch.setenv("AZURE_SEARCH_SERVICE_ENDPOINT", "https://example.search.windows.net")
    monkeypatch.setenv("AZURE_SEARCH_ADMIN_KEY", "dummy")
    monkeypatch.setenv("ALLOWED_TOOLS", "corporate,pmcoe,telecom")
    monkeypatch.setattr("tools.corporate.corporate_functions.index_name", "current")
    client = Mock()
    monkeypatch.setattr(chat, "client", client)
    return client


def _routing_result(name):
    return ChatCompletion.model_validate({
        "id": "routing",
        "model": "gpt-4o",
        "created": 0,
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "finish_reason": "tool_calls",
            "message": {"role": "assistant", "tool_calls": [{
                "id": "route-to-search",
                "type": "function",
                "function": {"name": name, "arguments": json.dumps({"query": "congés annuels"})},
            }]},
        }],
    })


def _search_response(request, hits):
    response = Response()
    response.status_code = 200
    response.headers["Content-Type"] = "application/json"
    response._content = json.dumps({"value": hits}).encode()
    wrapped = RequestsTransportResponse(request, response)
    wrapped.json = response.json
    return wrapped


def _request():
    return MessageRequest(
        query="congés annuels", messages=[], quotedText=None,
        model="gpt-4o", tools=["corporate"], lang="fr", top=10,
    )


@pytest.mark.parametrize("stream", [False, True])
def test_myssc_search_uses_alias_and_passes_through_citations(fake_openai, stream):
    hit = {"@search.score": 0.02, "chunk": "Politique sur les congés annuels.",
           "title": "Congés", "url": "https://example.com/conges"}
    answer = chat._no_search_results("gpt-4o", "fr")
    answer.choices[0].message.content = "Voir la politique [doc1]."
    fake_openai.chat.completions.create.side_effect = [_routing_result("intranet_question"), answer]
    fake_openai.embeddings.create.return_value.data = [Mock(embedding=[0.1] * 1536)]

    def send(_, request, **kwargs):
        body = json.loads(request.body)
        assert "/indexes('current')/docs/" in unquote(request.url)
        assert body["search"] == "congés annuels"
        assert body["filter"] == "langcode eq 'fr'"
        assert body["top"] == 10
        assert body["vectorQueries"][0]["fields"] == "embedding"
        return _search_response(request, [hit])

    with patch.object(RequestsTransport, "send", autospec=True, side_effect=send):
        tools, completion, context = chat.chat_with_data(_request(), stream=stream)

    fake_openai.embeddings.create.assert_called_once_with(model="text-embedding-ada-002", input="congés annuels")
    routing, grounded = fake_openai.chat.completions.create.call_args_list
    assert routing.kwargs["tool_choice"]["function"]["name"] == "intranet_question"
    assert grounded.kwargs["stream"] is stream
    assert "extra_body" not in grounded.kwargs
    assert json.loads(grounded.kwargs["messages"][-1]["content"])["passages"] == [
        {"id": "doc1", "title": hit["title"], "text": hit["chunk"]},
    ]
    assert chat.convert_chat_with_data_response(completion, "fr", tools, context).message.context.citations[0].url == hit["url"]


@pytest.mark.parametrize("empty_results", [False, True])
def test_search_failure_or_no_hits_never_falls_back_to_chat(fake_openai, empty_results):
    fake_openai.chat.completions.create.return_value = _routing_result("intranet_question")
    fake_openai.embeddings.create.return_value.data = [Mock(embedding=[0.1] * 1536)]

    def send(_, request, **kwargs):
        if empty_results:
            return _search_response(request, [])
        raise ServiceRequestError("Search not reachable")

    with patch.object(RequestsTransport, "send", autospec=True, side_effect=send):
        if empty_results:
            _, completion, context = chat.chat_with_data(_request(), stream=True)
            assert context.citations == []
            assert "aucun passage" in completion.choices[0].message.content
        else:
            with pytest.raises(SearchRetrievalError, match="retrieval failed"):
                chat.chat_with_data(_request())
    fake_openai.chat.completions.create.assert_called_once()


@pytest.mark.parametrize("tool_type,vector_field,semantic", [
    ("pmcoe", "text_vector", True),
    ("telecom", "custom_vector", False),
])
def test_non_corporate_search_uses_index_schema(fake_openai, tool_type, vector_field, semantic):
    index = SearchIndex({
        "name": tool_type,
        "fields": [
            {"name": "file_name", "type": "Edm.String"},
            {"name": "chunk", "type": "Edm.String"},
            {"name": vector_field, "type": "Collection(Edm.Single)", "dimensions": 3072},
        ],
        "semantic": {"defaultConfiguration": "pm-semantic", "configurations": [{
            "name": "pm-semantic",
            "prioritizedFields": {"titleField": {"fieldName": "file_name"},
                                  "prioritizedContentFields": [{"fieldName": "chunk"}]},
        }]},
    })
    fake_openai.embeddings.create.return_value.data = [Mock(embedding=[0.1] * 3072)]
    source = SearchSourceConfig(
        index_name=tool_type, embedding_model="text-embedding-3-large", top_n_documents=20,
        query_type="vector_semantic_hybrid" if semantic else "vector_simple_hybrid",
        use_language_filter=semantic,
    )

    def send(_, request, **kwargs):
        body = json.loads(request.body)
        assert body.get("semanticConfiguration") == ("pm-semantic" if semantic else None)
        assert body["queryType"] == ("semantic" if semantic else "simple")
        assert body.get("filter") == ("langcode eq 'fr'" if semantic else None)
        assert body["vectorQueries"][0]["fields"] == vector_field
        return _search_response(request, [{"@search.score": 0.02, "chunk": "Template", "file_name": "plan.docx"}])

    with (
        patch("utils.search.SearchIndexClient") as index_client,
        patch.object(RequestsTransport, "send", autospec=True, side_effect=send),
    ):
        index_client.return_value.__enter__.return_value.get_index.return_value = index
        context = retrieve_context(fake_openai, source, tool_type, "plan du projet", "fr")
    completion = chat.build_completion_response(
        "Voir [doc1].", None, tools_info=[ToolInfo(tool_type=tool_type, function_name=tool_type)],
        lang="fr", retrieval_context=context,
    )
    citation = completion.message.context.citations[0]
    assert citation.title == "plan.docx"
    if semantic:
        assert citation.url.endswith("/fr/plan.docx")
    fake_openai.embeddings.create.assert_called_once_with(
        model="text-embedding-3-large", dimensions=3072, input="plan du projet"
    )
