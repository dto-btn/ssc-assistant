from src.entity.table_row_entity import ChatTableRow, TableRowMetadata

class ChatTableDaoInterface:
    """
    An interface that is intended to read from the `chat` table in Azure Table Storage.
    """

    def all(self) -> list[ChatTableRow]:
        raise NotImplementedError