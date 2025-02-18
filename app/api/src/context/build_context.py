import os
from typing import Union

from azure.identity import DefaultAzureCredential
from azure.data.tables import TableServiceClient

from src.dao.chat_table_dao_memory_cache_adapter import ChatTableDaoMemoryCacheAdapter
from src.context.context_types import AppContext
from src.service.stats_report_service import StatsReportService
from src.dao.chat_table_dao import ChatTableDaoImpl
from src.repository.conversation_repository import ConversationRepository

instance: Union[AppContext, None] = None


def build_context() -> AppContext:
    global instance
    if instance is None:
        credential = DefaultAzureCredential()
        table_service_client = TableServiceClient(
            endpoint=os.getenv("DATABASE_ENDPOINT") or "", credential=credential
        )
        chat_table_dao = ChatTableDaoMemoryCacheAdapter(
            ChatTableDaoImpl(table_service_client)
        )
        conversation_repo = ConversationRepository(chat_table_dao)
        stats_report_service = StatsReportService(conversation_repo)

        instance = AppContext(
            credential=credential,
            table_service_client=table_service_client,
            chat_table_dao=chat_table_dao,
            conversation_repo=conversation_repo,
            stats_report_service=stats_report_service,
        )

    return instance
