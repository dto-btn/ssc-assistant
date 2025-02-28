from datetime import datetime
import pytest
from src.dao.suggestion_context_dao import SuggestionContextDao
from src.entity.suggestion_context_entity import SuggestionContextEntity


@pytest.fixture(scope="function")
def suggestion_context_dao() -> SuggestionContextDao:
    suggestion_context_dao = SuggestionContextDao()
    return suggestion_context_dao


def test_suggestion_context_can_instantiate(
    suggestion_context_dao: SuggestionContextDao,
):
    assert suggestion_context_dao is not None

def test_get_suggestion_context_by_id_returns_empty_with_empty_db(
    suggestion_context_dao: SuggestionContextDao,
):
    suggestions = suggestion_context_dao.get_suggestion_context_by_id(
        "this-id-wont-exist-in-db"
    )
    assert suggestions is None


def test_get_suggestion_context_by_id_returns_suggestion(
    suggestion_context_dao: SuggestionContextDao,
):
    TEST_ID = "this-id-will-exist-in-db"
    suggestion_context_dao._suggestions = [
        SuggestionContextEntity(
            id=TEST_ID,
            citations=[],
            content="this is a test suggestion",
            language="en",
            original_query="user's query",
            requester="test",
            success=True,
            timestamp=datetime.now(),
        )
    ]
    suggestions = suggestion_context_dao.get_suggestion_context_by_id(TEST_ID)
    assert suggestions is not None
    assert suggestions.id == TEST_ID
    assert suggestions.content == "this is a test suggestion"