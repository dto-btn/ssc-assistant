from datetime import datetime
from typing import List, override
from src.dao.suggestion_context.suggestion_context_dao_mapper import (
    SuggestionContextDaoMapper,
)
from src.dao.suggestion_context.suggestion_context_dao_types import (
    BaseSuggestionContextDao,
)
from src.db.sql_entities import SuggestionContextSqlEntity
from src.db.sql_session_provider import SqlSessionProvider
from src.service.suggestion_service_types import (
    SuggestionCitation,
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)
from sqlalchemy import Select
from uuid import uuid4


class SuggestionContextDao(BaseSuggestionContextDao):
    """
    For now, this is an in-memory implementation of the SuggestionContextDao.
    It will be replaced with a database implementation in the future.
    """

    def __init__(self, sql_session_provider: SqlSessionProvider):
        self.sql_session_provider = sql_session_provider

    @override
    def get_suggestion_context_by_id(
        self, id: str
    ) -> SuggestionContextWithSuggestionsAndId:
        with self.sql_session_provider.provide() as session:
            suggestion_context = session.query(SuggestionContextSqlEntity).get(id)

        if suggestion_context is None:
            return None

        return SuggestionContextDaoMapper.from_sql(suggestion_context)

    @override
    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestions
    ) -> SuggestionContextWithSuggestionsAndId:
        sql_entity = SuggestionContextDaoMapper.to_sql(suggestion)
        with self.sql_session_provider.provide() as session:
            session.add(sql_entity)
            session.commit()
            session.refresh(sql_entity)
        return SuggestionContextDaoMapper.from_sql(sql_entity)

    @override
    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        """
        Deletes all suggestions older than delete_before.
        The cutoff is inclusive, so suggestions with a timestamp equal to the cutoff will also be deleted.
        """
        with self.sql_session_provider.provide() as session:
            session.query(SuggestionContextSqlEntity).filter(
                SuggestionContextSqlEntity.created_at <= delete_before_inclusive
            ).delete()
            session.commit()
