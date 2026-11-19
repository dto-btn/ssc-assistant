from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

from apiflask import APIFlask
import pytest

from src.dao.suggestion_context.suggestion_context_dao_mapper import (
    SuggestionContextDaoMapper,
)
from src.db.sql_entities import SuggestionContextSqlEntity


@pytest.mark.parametrize(
    "created_at",
    [
        datetime(2026, 11, 9, 12, 0, 0, 123456),
        datetime(2026, 11, 9, 7, 0, 0, 123456, tzinfo=timezone(timedelta(hours=-5))),
    ],
    ids=["naive-utc", "non-utc-offset"],
)
def test_get_saved_sql_suggestion_returns_utc_timestamp(
    monkeypatch: pytest.MonkeyPatch, created_at: datetime
) -> None:
    # Keep module-level client initialization offline when importing the blueprint.
    monkeypatch.setenv("BLOB_ENDPOINT", "https://example.invalid")
    monkeypatch.setenv("DATABASE_ENDPOINT", "https://example.invalid")
    monkeypatch.setenv("SKIP_USER_VALIDATION", "true")
    from v1 import routes_v1

    suggestion = SuggestionContextSqlEntity(
        id="saved-suggestion",
        created_at=created_at,
        language="en",
        original_query="Question?",
        requester="mysscplus",
        content="Answer.",
        citations=[],
    )
    service = Mock()
    service.get_suggestioncontext_by_id.return_value = (
        SuggestionContextDaoMapper.from_sql(suggestion)
    )
    monkeypatch.setattr(
        routes_v1, "build_prod_context", lambda: {"suggestion_service": service}
    )

    app = APIFlask(__name__)
    app.register_blueprint(routes_v1.api_v1, url_prefix="/api/1.0")
    response = app.test_client().get(
        "/api/1.0/suggest?suggestionContextId=saved-suggestion"
    )

    assert response.status_code == 200
    assert response.json["timestamp"] == "2026-11-09T12:00:00.123Z"
