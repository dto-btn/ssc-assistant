from typing import Literal, TypedDict

type ConversationMessageSender = Literal["assistant", "user"]


class ConversationMessageEntity(TypedDict):
    message_id: str
    conversation_id: str
    created_at: str
    sender: ConversationMessageSender
    content: str
    # It is possible for the owner_id to be None, if we did not record the owner_id.
    owner_id: str | None


class ConversationEntity(TypedDict):
    conversation_id: str
    created_at: str
    # It is possible for the owner_id to be None, if we did not record the owner_id.
    owner_id: str | None
    messages: list[ConversationMessageEntity]
