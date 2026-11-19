from datetime import timezone

from src.db.sql_entities import SuggestionContextSqlEntity
from src.service.suggestion_service_types import (
    SuggestionCitation,
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)


class SuggestionContextDaoMapper:
    @staticmethod
    def from_sql(
        sql_entity: SuggestionContextSqlEntity,
    ) -> SuggestionContextWithSuggestionsAndId:
        created_at = sql_entity.created_at
        # The timezone-less SQL column stores UTC timestamps.
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        else:
            created_at = created_at.astimezone(timezone.utc)

        return SuggestionContextWithSuggestionsAndId(
            id=sql_entity.id,
            success=True,  # we never save a suggestion that was not successful
            language=sql_entity.language,
            original_query=sql_entity.original_query,
            timestamp=created_at.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
            requester=sql_entity.requester,
            content=sql_entity.content,
            citations=[
                # Note that citations is a JSON table column
                SuggestionCitation(title=citation["title"], url=citation["url"])
                for citation in sql_entity.citations
            ],
        )

    @staticmethod
    def to_sql(entity: SuggestionContextWithSuggestions) -> SuggestionContextSqlEntity:
        sql_entity: SuggestionContextSqlEntity = SuggestionContextSqlEntity()
        sql_entity.id = None
        sql_entity.language = entity["language"]
        sql_entity.original_query = entity["original_query"]
        sql_entity.requester = entity["requester"]
        sql_entity.content = entity["content"]
        sql_entity.citations = [
            {"title": citation["title"], "url": citation["url"]}
            for citation in entity["citations"]
        ]
        sql_entity.created_at = entity["timestamp"]

        return sql_entity
