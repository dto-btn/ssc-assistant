from datetime import datetime
from typing import List
from src.service.suggestion_service_types import (
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)
from uuid import uuid4

class SuggestionContextDao:
    """
    For now, this is an in-memory implementation of the SuggestionContextDao.
    It will be replaced with a database implementation in the future.
    """

    def __init__(self):
        self._suggestions: List[SuggestionContextWithSuggestionsAndId] = []

    def get_suggestion_context_by_id(
        self, suggestion_id: str
    ) -> SuggestionContextWithSuggestionsAndId:
        return next(
            (
                suggestion
                for suggestion in self._suggestions
                if suggestion["suggestion_id"] == suggestion_id
            ),
            None,
        )

    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestions
    ) -> SuggestionContextWithSuggestionsAndId:
        suggestion_context_with_id: SuggestionContextWithSuggestionsAndId = (
            SuggestionContextWithSuggestionsAndId(
                suggestion_id=str(uuid4()),
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