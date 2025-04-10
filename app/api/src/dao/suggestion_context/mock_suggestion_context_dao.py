from datetime import datetime
from typing import List, override
from src.dao.suggestion_context.suggestion_context_dao_types import (
    BaseSuggestionContextDao,
)
from src.service.suggestion_service_types import (
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)
from uuid import uuid4


class MockSuggestionContextDao(BaseSuggestionContextDao):
    """
    An in-memory implementation of the SuggestionContextDao, used in testing.
    """

    def __init__(self):
        self._suggestions: List[SuggestionContextWithSuggestionsAndId] = []

    @override
    def get_suggestion_context_by_id(
        self, id: str
    ) -> SuggestionContextWithSuggestionsAndId:
        return next(
            (suggestion for suggestion in self._suggestions if suggestion["id"] == id),
            None,
        )

    @override
    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestions
    ) -> SuggestionContextWithSuggestionsAndId:
        suggestion_context_with_id: SuggestionContextWithSuggestionsAndId = (
            SuggestionContextWithSuggestionsAndId(
                id=str(uuid4()),
                success=suggestion["success"],
                language=suggestion["language"],
                original_query=suggestion["original_query"],
                timestamp=suggestion["timestamp"],
                requester=suggestion["requester"],
                content=suggestion["content"],
                citations=[
                    {"title": citation["title"], "url": citation["url"]}
                    for citation in suggestion["citations"]
                ],
            )
        )
        self._suggestions.append(suggestion_context_with_id)
        return suggestion_context_with_id

    @override
    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        """
        Deletes all suggestions older than delete_before.
        The cutoff is inclusive, so suggestions with a timestamp equal to the cutoff will also be deleted.
        """
        self._suggestions = [
            suggestion
            for suggestion in self._suggestions
            if suggestion["timestamp"] > delete_before_inclusive
        ]
