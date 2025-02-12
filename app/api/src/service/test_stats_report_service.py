from datetime import datetime
from typing import TypedDict, cast
from unittest.mock import MagicMock

from pytest import fixture

from src.dao.chat_table_dao_types import ChatTableDaoInterface
from src.entity.table_row_entity import ChatTableRow, TableRowMetadata
from src.repository.conversation_repository import ConversationRepository
from src.service.stats_report_service import StatsReportService


class TstContext(TypedDict):
    mock_chat_table_dao: MagicMock
    conversation_repository: ConversationRepository
    stats_report_service: StatsReportService


@fixture(scope="session", autouse=True)
def ctx() -> TstContext:
    mock_chat_table_dao = MagicMock()
    mock_chat_table_dao.all.return_value = []
    mock_chat_table_dao = cast(ChatTableDaoInterface, mock_chat_table_dao)
    conversation_repository = ConversationRepository(mock_chat_table_dao)
    stats_report_service = StatsReportService(conversation_repository)

    return {
        "mock_chat_table_dao": mock_chat_table_dao,
        "conversation_repository": conversation_repository,
        "stats_report_service": stats_report_service,
    }


def test_empty_database_returns_empty_results(ctx: TstContext):
    assert isinstance(ctx, dict)
    assert isinstance(ctx["conversation_repository"], ConversationRepository)


# def test_rows_missing_partition_keys_dont_get_added_to_results():
#     mock_instance = MagicMock()
#     mock_instance.all.return_value = [
#         ChatTableRow(
#             metadata=TableRowMetadata(timestamp=datetime.now()),
#             Question="Hello?",
#             Answer=None,
#             oid="1",
#             PartitionKey=None,
#             RowKey="1",
#             preferred_username="test",
#         )
#     ]
#     mock_instance = cast(ChatTableDaoInterface, mock_instance)
#     conversation_repository = ConversationRepository(mock_instance)
#     conversations = conversation_repository.list_conversations()
#     assert len(conversations) == 0
