from typing import TypedDict
from unittest.mock import MagicMock
from pytest import fixture

from src.service.suggestion_service import SuggestionService


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


def test_instantiation(ctx: TestContext):
    assert isinstance(ctx, dict)
    assert isinstance(ctx["suggestion_service"], SuggestionService)
    assert isinstance(ctx["mock_suggest_table_client"], MagicMock)
    assert ctx["suggestion_service"].suggest_client == ctx["mock_suggest_table_client"]
