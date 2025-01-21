from dao.chat_table_dao import ChatTableDaoInterface
from entity.user_entity import UserEntity
from mapper.table_entity_common_fields_mapper import TableEntityCommonFieldsMapper


class UserRepository:
    def __init__(self, chat_table_dao: ChatTableDaoInterface):
        self.chat_table_dao = chat_table_dao

    def list_users(self, log_validation_errors: bool = False) -> list[UserEntity]:
        # iterate over all messages, and collate a list of users.
        # the "msg.oid" field has the unique ID
        # the "msg.preferred_username" field has the username
        chat_entities = self.chat_table_dao.all()

        users: dict[str, UserEntity] = {}
        for msg in chat_entities:
            common_fields = (
                TableEntityCommonFieldsMapper.extract_and_validate_common_fields(
                    "chatrow", msg, log_validation_errors=log_validation_errors
                )
            )
            if common_fields is None:
                continue

            timestamp = common_fields.get("timestamp")

            is_user_msg = msg.get("Question")

            # Right now we are only processing user messages.
            if not is_user_msg:
                continue

            oid = msg.get("oid")

            # if the oid is not present, we can't do anything.
            if oid is None:
                continue

            username = msg.get("preferred_username")

            if oid not in users:
                users[oid] = UserEntity(
                    user_id=oid,
                    username=username or "",
                    created_at=timestamp,
                    last_message_at=timestamp,
                )
            else:
                user = users[oid]

                # if the timestamp is older, created_at is updated
                if timestamp < user["created_at"]:
                    user["created_at"] = timestamp

                # if the timestamp is newer, update last_message_at
                if timestamp > user["last_message_at"]:
                    user["last_message_at"] = timestamp

                    # if the username is different, update that too.
                    if user["username"] != username and username is not None:
                        print(
                            f"User {oid} changed username from {user['username']} to {username} on {timestamp}"
                        )
                        user["username"] = username

        return list(users.values())
