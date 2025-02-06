from typing import TypedDict


class UserEntity(TypedDict):
    user_id: str
    username: str
    last_message_at: str
    created_at: str
