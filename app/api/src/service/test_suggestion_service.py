import datetime
import json
from typing import TypedDict
import typing
from unittest.mock import MagicMock
from pytest import fixture, MonkeyPatch
import pytest
from openai.types.chat import ChatCompletion
from openai.types.chat.chat_completion import Choice, ChatCompletionMessage
from src.context.build_context import build_context
from src.dao.suggestion_context_dao import SuggestionContextDao

from src.service.suggestion_service import SuggestionService
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_EN, SUGGEST_SYSTEM_PROMPT_FR


class LocalTestContext(TypedDict):
    # mock_suggest_table_client: MagicMock
    suggestion_service: SuggestionService
    suggestion_context_dao: SuggestionContextDao


@fixture(scope="session", autouse=True)
def ctx() -> LocalTestContext:
    # mock_suggest_table_client = MagicMock()
    # suggestion_service = SuggestionService(mock_suggest_table_client)

    # return {
    #     "mock_suggest_table_client": mock_suggest_table_client,
    #     "suggestion_service": suggestion_service,
    # }
    ctx = build_context()
    suggestion_context_dao = ctx["suggestion_context_dao"]
    suggestion_service = ctx["suggestion_service"]
    return {
        "suggestion_context_dao": suggestion_context_dao,
        "suggestion_service": suggestion_service,
    }


@fixture(scope="function", autouse=True)
def mock_chat_with_data(monkeypatch: MonkeyPatch):
    mock_func = MagicMock()

    # We have to do this because the ChatCompletion object from openai does not have a context field.
    # I think the context field only exists in Azure OpenAI, which is not fully expressed in the openai
    # package.
    # This subclass allows the ChatCompletionMessage to have a context field.
    class ChatCompletionMessageWithContext(ChatCompletionMessage):
        context: typing.Any

    chat_completion = ChatCompletion(
        id="test_id",
        object="chat.completion",
        created=-1,
        model="test_model",
        choices=[
            Choice(
                finish_reason="stop",
                index=0,
                message=ChatCompletionMessageWithContext(
                    role="assistant",
                    content="test_content",
                    context={
                        "citations": [
                            {
                                "content": "test citation 1 content",
                                "title": "test citation 1 title",
                                "url": "test citation 1 url",
                                "filepath": None,
                                "chunk_id": 0,
                            },
                            {
                                "content": "test citation 1 content",
                                "title": "test citation 1 title",
                                "url": "test citation 1 url",
                                "filepath": None,
                                "chunk_id": 0,
                            },
                            {
                                "content": "test citation 1 content",
                                "title": "test citation 1 title",
                                "url": "test citation 1 url",
                                "filepath": None,
                                "chunk_id": 0,
                            },
                        ],
                        # Unexpectedly, it seems intent is passed down as a string, not a list.
                        "intent": json.dumps(
                            [
                                "test_intent_1",
                                "test_intent_2",
                                "test_intent_3",
                            ]
                        ),
                    },
                ),
            )
        ],
    )

    mock_func.return_value = (None, chat_completion)
    monkeypatch.setattr("src.service.suggestion_service.chat_with_data", mock_func)
    return mock_func

def test_remove_citation_content(ctx: LocalTestContext, mock_chat_with_data):
    """
    Test that the citations are removed from the content at all times.
    """
    mock_chat_with_data.return_value[1].choices[0].message.context = {
        "citations": [
            {
                "content": "CONTENT 1",
                "title": "TITLE 1",
                "url": "URL 1",
                "filepath": None,
                "chunk_id": 0,
            },
            {
                "content": "CONTENT 2",
                "title": "TITLE 2",
                "url": "URL 2",
                "filepath": None,
                "chunk_id": 0,
            },
            {
                "content": "CONTENT 3",
                "title": "TITLE 3",
                "url": "URL 3",
                "filepath": None,
                "chunk_id": 0,
            },
        ],
        "intent": "[]",
    }

    response = ctx["suggestion_service"].suggest(
        "cool",
        {"language": "en", "requester": "someone_cool"},
    )

    assert response["success"] is True
    assert len(response["citations"]) == 3
    assert response["citations"][0] == {
        "title": "TITLE 1",
        "url": "URL 1",
    }
    assert response["citations"][1] == {
        "title": "TITLE 2",
        "url": "URL 2",
    }
    assert response["citations"][2] == {
        "title": "TITLE 3",
        "url": "URL 3",
    }


def test_dedupe_citations(ctx: LocalTestContext, mock_chat_with_data):
    # add duplicate citations in the context
    mock_chat_with_data.return_value[1].choices[0].message.context = {
        "citations": [
            {
                "content": "CONTENT 1",
                "title": "TITLE 1",
                "url": "SAME_URL",
                "filepath": None,
                "chunk_id": 0,
            },
            {
                "content": "CONTENT 2",
                "title": "TITLE 2",
                "url": "SAME_URL",
                "filepath": None,
                "chunk_id": 0,
            },
            {
                "content": "CONTENT 3",
                "title": "TITLE 3",
                "url": "SAME_URL",
                "filepath": None,
                "chunk_id": 0,
            },
        ],
        "intent": "[]",
    }

    response = ctx["suggestion_service"].suggest(
        "cool",
        {"language": "en", "requester": "someone_cool", "dedupe_citations": True},
    )

    assert response["success"] is True
    assert len(response["citations"]) == 1
    assert response["citations"][0] == {
        "title": "TITLE 1",
        "url": "SAME_URL",
    }


def test_remove_citations_from_content(ctx: LocalTestContext, mock_chat_with_data):
    mock_chat_with_data.return_value[1].choices[
        0
    ].message.content = "This is a [doc0] test [doc1] string [doc2]."

    response = ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": "en",
            "requester": "someone_cool",
            "remove_citations_from_content": True,
        },
    )

    assert response["success"] is True
    assert response["content"] == "This is a  test  string ."


def test_instantiation(ctx: LocalTestContext):
    assert isinstance(ctx, dict)
    assert isinstance(ctx["suggestion_service"], SuggestionService)
    # assert isinstance(ctx["mock_suggest_table_client"], MagicMock)
    # assert ctx["suggestion_service"].suggest_client == ctx["mock_suggest_table_client"]


# Behavioural requirements:
# 1. When a suggestion is done with an invalid query, the response has a flag "success" set to False and "reason" set to "INVALID_QUERY."
# 2. When a suggestion is done with a valid query, the response has a flag "success" set to True and a suggestion context.
# 3. The response has a language field set to the language of the suggestion response.
# 4. The response has a query field set to the query that was used to generate the suggestion.
# 5. The response has a timestamp field set to the time the suggestion was generated.
# 6. The response has a requester field set to the application that requested the suggestion.

# IN CASE OF VALID QUERY:
# 7. Citations were fetched from the database.
# 8. The suggestion was saved to the database.


@pytest.mark.parametrize(
    "invalid_query",
    [
        None,
        "",
        " ",
        "  ",
    ],
)
def test_invalid_query(ctx: LocalTestContext, invalid_query: str | None):
    response = ctx["suggestion_service"].suggest(invalid_query, {})
    assert response["success"] is False
    assert response["reason"] == "INVALID_QUERY"


def test_valid_query(ctx: LocalTestContext):
    response = ctx["suggestion_service"].suggest(
        "valid query",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )
    assert response["success"] is True
    assert response["language"] == "en"
    assert response["original_query"] == "valid query"
    assert response["requester"] == "someone_cool"

# language tests


@pytest.mark.parametrize(
    "expected_language, expected_valid",
    [
        ("en", True),
        ("fr", True),
        ("es", False),
        ("", False),
        ("  ", False),
        (None, False),
    ],
)
def test_language(
    ctx: LocalTestContext,
    expected_language: str,
    expected_valid: bool,
    mock_chat_with_data: MagicMock,
):
    response = ctx["suggestion_service"].suggest(
        "Query with language ${language}",
        {
            "language": expected_language,
            "requester": "someone_cool",
        },
    )

    if expected_valid:
        assert response["success"] is True
        assert response["language"] == expected_language
    else:
        assert response["success"] is False
        assert response["reason"] == "INVALID_LANGUAGE"


@pytest.mark.parametrize(
    "input_query, output_query",
    [
        ("cool", "cool"),
        ("cool ", "cool"),
        (" cool", "cool"),
        (" cool ", "cool"),
        ("  cool  ", "cool"),
    ],
)
def test_response_original_query_is_set_to_the_query_used_to_generate_the_suggestion(
    ctx: LocalTestContext,
    input_query: str,
    output_query: str,
):
    response = ctx["suggestion_service"].suggest(
        input_query,
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )
    assert response["success"] is True
    assert response["original_query"] == output_query


# 4. The response has a query field set to the query that was used to generate the suggestion.
@pytest.mark.parametrize(
    "time_now, expected_output",
    [
        (datetime.datetime(2022, 1, 1, 0, 0, 0, 0), "2022-01-01T00:00:00.000Z"),
        (datetime.datetime(2000, 1, 2, 0, 0, 0, 0), "2000-01-02T00:00:00.000Z"),
        (datetime.datetime(2022, 1, 1, 12, 30, 0, 0), "2022-01-01T12:30:00.000Z"),
        (datetime.datetime(2000, 1, 2, 12, 30, 0, 0), "2000-01-02T12:30:00.000Z"),
    ],
)
def test_response_timestamp_is_set_to_the_time_the_suggestion_was_generated(
    ctx: LocalTestContext,
    time_now: datetime.datetime,
    expected_output: str,
):
    # mock the datetime module using pytest
    with pytest.MonkeyPatch.context() as m:
        m.setattr(
            ctx["suggestion_service"], "_generate_datetime_object", lambda: time_now
        )

        response = ctx["suggestion_service"].suggest(
            "cool",
            {
                "language": "en",
                "requester": "someone_cool",
            },
        )
        assert response["timestamp"] == expected_output


def test_requester_field_is_set_to_the_application_that_requested_the_suggestion(
    ctx: LocalTestContext,
):
    response = ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )
    assert response["success"] is True
    assert response["requester"] == "someone_cool"


@pytest.mark.parametrize(
    "language, expected_system_prompt",
    [
        ("en", SUGGEST_SYSTEM_PROMPT_EN),
        ("fr", SUGGEST_SYSTEM_PROMPT_FR),
    ],
)
def test_uses_the_right_language_prompt_by_default(
    ctx: LocalTestContext,
    language: str,
    expected_system_prompt: str,
    mock_chat_with_data: MagicMock,
):
    ctx["suggestion_service"].suggest(
        "cool",
        {"language": language, "requester": "someone_cool"},
    )

    assert mock_chat_with_data.call_count == 1
    system_prompt_message = mock_chat_with_data.call_args[0][0].messages[0]
    assert system_prompt_message.content == expected_system_prompt
    assert system_prompt_message.role == "system"


@pytest.mark.parametrize(
    "language",
    [
        ("en"),
        ("fr"),
    ],
)
def test_uses_the_opts_system_prompt_as_override_when_passed_in(
    ctx: LocalTestContext, mock_chat_with_data: MagicMock, language: str
):
    TEST_SYSTEM_PROMPT = "this is a test system prompt"

    ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": language,
            "requester": "someone_cool",
            "system_prompt": TEST_SYSTEM_PROMPT,
        },
    )

    assert mock_chat_with_data.call_count == 1
    system_prompt_message = mock_chat_with_data.call_args[0][0].messages[0]

    # should be the system prompt that was passed in. not the default language prompt.
    assert system_prompt_message.content == TEST_SYSTEM_PROMPT
    assert system_prompt_message.role == "system"

    # it may have overridden the prompt, but it still returns the language setting
    assert mock_chat_with_data.call_args[0][0].lang == language

def test_returns_internal_error_if_chat_with_data_response_is_not_chat_completion(
    ctx: LocalTestContext, mock_chat_with_data: MagicMock
):
    mock_chat_with_data.return_value = (
        None,
        "a string is not a ChatCompletion object.",
    )
    response = ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )

    assert response["success"] is False
    assert response["reason"] == "INTERNAL_ERROR"


# suggestioncontext is saved to the database
def test_suggestioncontext_is_saved_to_the_database(ctx: LocalTestContext):
    # spy on suggestion_context_dao
    suggestion_context_dao = ctx["suggestion_context_dao"]

    assert len(suggestion_context_dao._suggestions) == 0
    response = ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )

    assert response["success"] is True
    assert response["content"] == "test_content"
    assert len(suggestion_context_dao._suggestions) == 1
    assert suggestion_context_dao._suggestions[0]["content"] == "test_content"

    # check that the suggestioncontext is saved to the database
    # ctx["mock_suggest_table_client"].store_suggestion.assert_called_once_with(
    #     response["suggestioncontext"], "someone_cool"
    # )


# suggestioncontext expiration is set to 3 days
