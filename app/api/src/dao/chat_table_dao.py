# pyright: reportUnknownMemberType=false
# pyright: reportUnknownParameterType=false
# pyright: reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false


from typing import override
from azure.data.tables import TableServiceClient
from azure.core.paging import ItemPaged
from azure.data.tables import TableEntity, TableClient
from src.dao.chat_table_dao_types import ChatTableDaoInterface
from src.entity.table_row_entity import ChatTableRow, TableRowMetadata

from src.entity.table_row_entity import ChatTableRow, TableRowMetadata


class ChatTableDaoImpl(ChatTableDaoInterface):
    """
    The default implementation of the `ChatTableDaoInterface`.
    """

    def __init__(self, table_service_client: TableServiceClient):
        self.chat_table_client: TableClient = table_service_client.get_table_client(
            table_name="chat"
        )

    @override
    def all(self) -> list[ChatTableRow]:
        results_raw: ItemPaged[TableEntity] = self.chat_table_client.list_entities()  # type: ignore (this throws reportUnknownParameterType)
        results_list = [
            ChatTableRow(
                Answer=row.get("Answer"),
                Question=row.get("Question"),
                PartitionKey=row.get("PartitionKey"),
                RowKey=row.get("RowKey"),
                metadata=TableRowMetadata(timestamp=row.metadata.get("timestamp")),
                oid=row.get("oid"),
                preferred_username=row.get("preferred_username"),
            )
            for row in results_raw
        ]
        return results_list
