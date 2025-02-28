import pytest
from src.dao.suggestion_context_dao import SuggestionContextDao


@pytest.fixture(scope="function")
def suggestion_context_dao() -> SuggestionContextDao:
    suggestion_context_dao = SuggestionContextDao()
    return suggestion_context_dao


def test_suggestion_context_can_instantiate(
    suggestion_context_dao: SuggestionContextDao,
):
    assert suggestion_context_dao is not None
