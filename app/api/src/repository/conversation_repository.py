from src.dao.chat_table_dao import ChatTableDaoInterface
from src.entity.conversation_entity import ConversationEntity
from src.mapper.conversation_entity_mapper import ChatTableEntityMapper



class ConversationRepository:
    """
    This class acts as a high-level interface to the `chat` table in Azure Table Storage.
    It collates all the messages in the `chat` table into `ConversationEntity` objects by
    grouping messages by a common `conversation_id`.
    """

    def __init__(self, chat_table_dao: ChatTableDaoInterface):
        self.chat_table_dao = chat_table_dao

    def list_conversations(
        self, log_validation_errors: bool = False
    ) -> list[ConversationEntity]:
        """
        This function will return a list of all conversations in the chat table.
        It maps the data from the chat table to the ConversationEntity model.
        """

        # Get all chatrows from the chat table
        chat_table_rows = self.chat_table_dao.all()

        # This dictionary will store all conversations, with the PartitionKey as the key.
        # This is done to ensure that we don't have duplicate conversations.
        unique_conversations_dict: dict[str, ConversationEntity] = {}

        # Loop over all chatrows and create a conversation object for each conversation.
        for chatrow in chat_table_rows:
            message = (
                ChatTableEntityMapper.map_and_validate_to_conversation_message_entity(
                    chatrow, log_validation_errors=log_validation_errors
                )
            )

            if message is None:
                continue

            conversation_id = message["conversation_id"]
            convo = unique_conversations_dict.get(conversation_id)

            # If the conversation object does not exist, create a new one.
            if convo is None:
                convo = ConversationEntity(
                    conversation_id=conversation_id,
                    created_at=message["created_at"],
                    owner_id=message["owner_id"],
                    messages=[],
                )
                unique_conversations_dict[conversation_id] = convo

            convo["messages"].append(message)

        # Sort messages in each conversation by their created_at timestamp
        for convo in unique_conversations_dict.values():
            convo["messages"].sort(key=lambda msg: msg["created_at"])

        return list(unique_conversations_dict.values())
