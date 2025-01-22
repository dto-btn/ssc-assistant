# pyright: reportUnknownMemberType=false
# pyright: reportUnknownParameterType=false
# pyright: reportUnknownVariableType=false
# pyright: reportUnknownArgumentType=false


from src.entity.table_row_entity import (
    ChatTableRow,
    CommonTableRowEntityFields,
)


class TableEntityCommonFieldsMapper:
    @staticmethod
    def extract_and_validate_common_fields(
        entity_type_name: str, entity: ChatTableRow, log_validation_errors: bool = False
    ) -> CommonTableRowEntityFields | None:
        # Try and retrieve the partitionkey object from the msg.
        def log_validation_error(msg: str):
            if log_validation_errors:
                print(msg)

        partition_key = entity.get("PartitionKey")
        if partition_key is None or type(partition_key) is not str:
            # This should not happen, but if it does, we skip the entity as we can't process it fully.
            log_validation_error(
                f"f{entity_type_name} had missing or nonstring PartitionKey. Msg had PartitionKey: {entity.get('PartitionKey')}, RowKey: {entity.get('RowKey')}"
            )
            return None

        # Try and retrieve the rowkey object from the msg.
        row_key = entity.get("RowKey")
        if row_key is None or type(row_key) is not str:
            # This should not happen, but if it does, we skip the entity as we can't process it fully.
            log_validation_error(
                f"f{entity_type_name} had missing or nonstring RowKey: Msg had PartitionKey: {entity.get('PartitionKey')}, RowKey: {entity.get('RowKey')}"
            )
            return None

        # Get the timestamp of the entity, which is used in multiple places in this code.
        timestamp = entity.get("metadata", {}).get("timestamp")
        if timestamp is None:
            # This should not happen, but if it does, we skip the entity as we can't process it fully.
            log_validation_error(
                f"f{entity_type_name} had missing timestamp: PartitionKey: Msg had PartiitonKey: {entity.get('PartitionKey')}, RowKey: {entity.get('RowKey')}"
            )
            return None

        timestamp = timestamp.isoformat()

        return CommonTableRowEntityFields(
            partition_key=partition_key, row_key=row_key, timestamp=timestamp
        )
