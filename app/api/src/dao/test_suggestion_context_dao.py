from datetime import datetime
import pytest
from src.dao.suggestion_context_dao import SuggestionContextDao
from src.entity.suggestion_context_entity import (
    SuggestionContextCitationEntity,
    SuggestionContextEntity,
)
from uuid import uuid4


def build_mock_suggestion_context_entity():
    uuid = str(uuid4())

    citation_1 = SuggestionContextCitationEntity(
        title="Some citation",
        url="https://example.com/some-citation",
    )
    citation_2 = SuggestionContextCitationEntity(
        title="Another citation",
        url="https://example.com/another-citation",
    )
    return SuggestionContextEntity(
        id=uuid,
        citations=[
            citation_1,
            citation_2,
        ],
        content="this is a test suggestion",
        language="en",
        original_query="user's query",
        requester="test",
        success=True,
        timestamp=datetime.now(),
    )


@pytest.fixture(scope="function")
def suggestion_context_dao() -> SuggestionContextDao:
    suggestion_context_dao_instance = SuggestionContextDao()
    return suggestion_context_dao_instance


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
    suggestion = build_mock_suggestion_context_entity()
    suggestion.id = TEST_ID
    suggestion_context_dao._suggestions = [suggestion]
    suggestions = suggestion_context_dao.get_suggestion_context_by_id(TEST_ID)
    assert suggestions is not None
    assert suggestions.id == TEST_ID

# can insert new suggestion


def test_insert_suggestion_context_inserts_suggestion(
    suggestion_context_dao: SuggestionContextDao,
):
    suggestion = build_mock_suggestion_context_entity()
    suggestion_context_dao.insert_suggestion_context(suggestion)
    assert len(suggestion_context_dao._suggestions) == 1
    assert suggestion_context_dao._suggestions[0] == suggestion


# can delete suggestion by oldest_timestamp
# def delete_suggestion_context_older_than(self, oldest_timestamp: datetime):


def test_delete_suggestion_context_older_than_deletes_suggestions(
    suggestion_context_dao: SuggestionContextDao,
):
    suggestion1 = build_mock_suggestion_context_entity()
    suggestion1.timestamp = datetime(2021, 1, 1)  # will be gone
    suggestion2 = build_mock_suggestion_context_entity()
    suggestion2.timestamp = datetime(2021, 1, 2)  # will be gone
    suggestion3 = build_mock_suggestion_context_entity()
    suggestion3.timestamp = datetime(2021, 1, 3)
    suggestion4 = build_mock_suggestion_context_entity()
    suggestion4.timestamp = datetime(2021, 1, 4)

    suggestion_context_dao._suggestions = [
        suggestion1,
        suggestion2,
        suggestion3,
        suggestion4,
    ]
    suggestion_context_dao.delete_suggestion_context_older_than(datetime(2021, 1, 2))
    assert len(suggestion_context_dao._suggestions) == 2
    assert suggestion3 in suggestion_context_dao._suggestions
    assert suggestion4 in suggestion_context_dao._suggestions
