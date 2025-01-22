# test class for ChatTableDaoInterface
from datetime import datetime
from typing import cast
from unittest.mock import MagicMock
from repository.conversation_repository import ConversationRepository
from entity.table_row_entity import ChatTableRow, TableRowMetadata
from dao.chat_table_dao import ChatTableDaoInterface


def test_empty_database_returns_empty_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = []
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_missing_partition_keys_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question="Hello?",
            Answer=None,
            oid="1",
            PartitionKey=None,
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_missing_row_key_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question="Hello?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey=None,
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_with_missing_timestamp_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=None),
            Question="Hello?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_with_question_and_answer_both_present_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question="Hello?",
            Answer="Hi!",
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_with_question_and_answer_both_absent_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question=None,
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_with_nonstring_question_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question=123,  # type: ignore
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_rows_with_nonstring_answer_dont_get_added_to_results():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question=None,
            Answer=123,  # type: ignore
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="test",
        )
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()
    assert len(conversations) == 0


def test_multiple_valid_rows_in_the_same_conversation_are_grouped():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question="Hello?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="user1",
        ),
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question=None,
            Answer="Hi there!",
            oid="1",
            PartitionKey="1",
            RowKey="2",
            preferred_username="user1",
        ),
        # Add two more rows
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question="How are you?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="3",
            preferred_username="user1",
        ),
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime.now()),
            Question=None,
            Answer="I'm good, thanks!",
            oid="1",
            PartitionKey="1",
            RowKey="4",
            preferred_username="user1",
        ),
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()

    assert len(conversations) == 1  # Only one conversation
    assert len(conversations[0]["messages"]) == 4  # All rows in the same conversation
    assert conversations[0]["messages"][0]["content"] == "Hello?"
    assert conversations[0]["messages"][1]["content"] == "Hi there!"
    assert conversations[0]["messages"][2]["content"] == "How are you?"
    assert conversations[0]["messages"][3]["content"] == "I'm good, thanks!"


def test_messages_are_ordered_chronologically():
    mock_instance = MagicMock()
    mock_instance.all.return_value = [
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime(2023, 10, 1, 10, 15, 0)),
            Question=None,
            Answer="I'm good, thanks!",
            oid="1",
            PartitionKey="1",
            RowKey="4",
            preferred_username="user1",
        ),
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime(2023, 10, 1, 10, 5, 0)),
            Question=None,
            Answer="Hi there!",
            oid="1",
            PartitionKey="1",
            RowKey="2",
            preferred_username="user1",
        ),
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime(2023, 10, 1, 10, 0, 0)),
            Question="Hello?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="1",
            preferred_username="user1",
        ),
        ChatTableRow(
            metadata=TableRowMetadata(timestamp=datetime(2023, 10, 1, 10, 10, 0)),
            Question="How are you?",
            Answer=None,
            oid="1",
            PartitionKey="1",
            RowKey="3",
            preferred_username="user1",
        ),
    ]
    mock_instance = cast(ChatTableDaoInterface, mock_instance)
    conversation_repository = ConversationRepository(mock_instance)
    conversations = conversation_repository.list_conversations()

    assert len(conversations) == 1  # Only one conversation
    assert len(conversations[0]["messages"]) == 4  # All rows in the same conversation
    assert conversations[0]["messages"][0]["content"] == "Hello?"
    assert conversations[0]["messages"][1]["content"] == "Hi there!"
    assert conversations[0]["messages"][2]["content"] == "How are you?"
    assert conversations[0]["messages"][3]["content"] == "I'm good, thanks!"
