from datetime import datetime
from typing import List
from src.entity.suggestion_context_entity import SuggestionContextEntity
from src.service.suggestion_service_types import (
    SuggestionContext,
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
        self._suggestions: List[SuggestionContextEntity] = []

    def get_suggestion_context_by_id(
        self, suggestion_id: str
    ) -> SuggestionContextWithSuggestionsAndId:
        return next(
            (
                suggestion
                for suggestion in self._suggestions
                if suggestion.suggestion_id == suggestion_id
            ),
            None,
        )

    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestionsAndId
    ) -> SuggestionContextEntity:
        suggestion_id = str(uuid4())
        suggestion_with_id = SuggestionContextEntity(
            suggestion_id=suggestion_id,
            citations=suggestion["citations"],
            content=suggestion["content"],
            language=suggestion["language"],
            original_query=suggestion["original_query"],
            requester=suggestion["requester"],
            success=suggestion["success"],
            timestamp=suggestion["timestamp"],
        )
        self._suggestions.append(suggestion_with_id)
        return suggestion_with_id

    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        """
        Deletes all suggestions older than delete_before.
        The cutoff is inclusive, so suggestions with a timestamp equal to the cutoff will also be deleted.
        """
        self._suggestions = [
            suggestion
            for suggestion in self._suggestions
            if suggestion.timestamp > delete_before_inclusive
        ]