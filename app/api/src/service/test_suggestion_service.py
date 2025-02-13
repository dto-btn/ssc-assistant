import datetime
from typing import TypedDict
from unittest.mock import MagicMock
from pytest import fixture, MonkeyPatch
import pytest
import utils.openai

import src.service.suggestion_service
from src.service.suggestion_service import SuggestionService
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_EN, SUGGEST_SYSTEM_PROMPT_FR

# always mock "from utils.openai import chat_with_data"


class TestContext(TypedDict):
    mock_suggest_table_client: MagicMock
    suggestion_service: SuggestionService


@fixture(scope="session", autouse=True)
def ctx() -> TestContext:
    mock_suggest_table_client = MagicMock()
    suggestion_service = SuggestionService(mock_suggest_table_client)

    return {
        "mock_suggest_table_client": mock_suggest_table_client,
        "suggestion_service": suggestion_service,
    }

@fixture(scope="function", autouse=True)
def mock_chat_with_data(monkeypatch: MonkeyPatch):
    mock_func = MagicMock()
    mock_func.return_value = None, {}
    monkeypatch.setattr("src.service.suggestion_service.chat_with_data", mock_func)
    return mock_func


def test_instantiation(ctx: TestContext):
    assert isinstance(ctx, dict)
    assert isinstance(ctx["suggestion_service"], SuggestionService)
    assert isinstance(ctx["mock_suggest_table_client"], MagicMock)
    assert ctx["suggestion_service"].suggest_client == ctx["mock_suggest_table_client"]


# Behavioural requirements:
# 1. When a suggestion is done with an invalid query, the response has a flag "has_suggestions" set to False and "reason" set to "INVALID_QUERY."
# 2. When a suggestion is done with a valid query, the response has a flag "has_suggestions" set to True and a suggestion context.
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
def test_invalid_query(ctx: TestContext, invalid_query: str | None):
    response = ctx["suggestion_service"].suggest(invalid_query, {})
    assert response["has_suggestions"] is False
    assert response["reason"] == "INVALID_QUERY"


def test_valid_query(ctx: TestContext):
    response = ctx["suggestion_service"].suggest(
        "valid query",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )
    assert response["has_suggestions"] is True
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
def test_language(ctx: TestContext, expected_language: str, expected_valid: bool):
    response = ctx["suggestion_service"].suggest(
        "Query with language ${language}",
        {
            "language": expected_language,
            "requester": "someone_cool",
        },
    )


    if expected_valid:
        assert response["has_suggestions"] is True
        assert response["language"] == expected_language
    else:
        assert response["has_suggestions"] is False
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
    ctx: TestContext,
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
    assert response["has_suggestions"] is True
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
    ctx: TestContext,
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
    ctx: TestContext,
):
    response = ctx["suggestion_service"].suggest(
        "cool",
        {
            "language": "en",
            "requester": "someone_cool",
        },
    )
    assert response["requester"] == "someone_cool"


def test_store_suggestion_request(ctx: TestContext):
    raise NotImplementedError(
        "Need to talk to team & implement this feature after discussion"
    )


@pytest.mark.parametrize(
    "language, expected_system_prompt",
    [
        ("en", SUGGEST_SYSTEM_PROMPT_EN),
        ("fr", SUGGEST_SYSTEM_PROMPT_FR),
    ],
)
def test_uses_the_right_language_prompt_by_default(
    ctx: TestContext,
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
    ctx: TestContext, mock_chat_with_data: MagicMock, language: str
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
