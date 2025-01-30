"""
This module contains the type definitions for the table row entities.
These are mappings of Azure Table Storage entities to Python dictionaries.
"""

from datetime import datetime
from typing import TypedDict


class TableRowMetadata(TypedDict):
    timestamp: datetime | None


class ChatTableRow(TypedDict):
    PartitionKey: str | None
    RowKey: str | None
    metadata: TableRowMetadata
    Question: str | None
    Answer: str | None
    oid: str | None
    preferred_username: str | None


class CommonTableRowEntityFields(TypedDict):
    partition_key: str
    row_key: str
    timestamp: str
