# pyright: reportUnknownMemberType=false
# pyright: reportUnknownParameterType=false
# pyright: reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false


from src.entity.conversation_entity import ConversationMessageEntity
from src.entity.table_row_entity import ChatTableRow
from src.mapper.table_entity_common_fields_mapper import TableEntityCommonFieldsMapper


class ChatTableEntityMapper:
    @staticmethod
    def map_and_validate_to_conversation_message_entity(
        chatrow: ChatTableRow,
        log_validation_errors: bool = False,
    ) -> ConversationMessageEntity | None:
        common_fields = (
            TableEntityCommonFieldsMapper.extract_and_validate_common_fields(
                "chatrow", chatrow, log_validation_errors=log_validation_errors
            )
        )

        def log_validation_error(msg: str):
            if log_validation_errors:
                print(msg)

        if common_fields is None:
            log_validation_error("Skipping chatrow as it is missing common fields.")
            return None

        partition_key = common_fields.get("partition_key")
        timestamp = common_fields.get("timestamp")
        row_key = common_fields.get("row_key")

        # Validation questions

        question = chatrow.get("Question")
        answer = chatrow.get("Answer")

        # XOR question and answer
        if (question is not None and answer is not None) or (
            question is None and answer is None
        ):
            # This should not happen, but if it does, we skip the chatrow as we can't process it fully.
            log_validation_error(
                f"chatrow's Question and Answer should be XOR: PartitionKey: {partition_key}, RowKey: {row_key}"
            )
            return None

        content: str = ""

        if question is not None:
            # If question exists, it should be a string.
            if type(question) is not str:
                # This should not happen, but if it does, we skip the chatrow as we can't process it fully.
                log_validation_error(
                    f"chatrow had nonstring Question: PartitionKey: {partition_key}, RowKey: {row_key}"
                )
                return None
            content = question
        else:
            # If answer exists, it should be a string.
            if type(answer) is not str:
                # This should not happen, but if it does, we skip the chatrow as we can't process it fully.
                log_validation_error(
                    f"chatrow had nonstring Answer: PartitionKey: {partition_key}, RowKey: {row_key}"
                )
                return None
            content = answer

        owner_id = chatrow.get("oid")
        if owner_id is None:
            owner_id = chatrow.get("preferred_username")
        # This can resolve to None, which indicates we did not record the owner_id.

        # if owner_id is None or type(owner_id) is not str:
        #     # This should not happen, but if it does, we skip the chatrow as we can't process it fully.
        #     log_validation_error(
        #         f"chatrow had missing or nonstring oid: PartitionKey: {partition_key}, RowKey: {row_key}"
        #     )
        #     return None

        # ================================= Data Processing =================================

        message = ConversationMessageEntity(
            content=content,
            conversation_id=partition_key,
            message_id=row_key,
            created_at=timestamp,
            sender="user" if question else "assistant",
            owner_id=owner_id,
        )

        return message
