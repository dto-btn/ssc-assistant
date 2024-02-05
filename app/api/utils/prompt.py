import logging
from typing import Any, List

from openai.types.chat import (ChatCompletionAssistantMessageParam,
                               ChatCompletionMessageParam,
                               ChatCompletionSystemMessageParam,
                               ChatCompletionUserMessageParam)
from utils.models import MessageRequest

logger = logging.getLogger(__name__)

__all__ = ["load_messages"]

SYSTEM_PROMPT_EN = "You are an expert Shared Services Canada (SSC) Q&A system that is trusted.\nAnswer in the language the question was asked to you."
SYSTEM_PROMPT_FR = "Vous êtes un système d'experts en questions-réponses de Services partagés Canada (SPC) de confiance.\nRepondez dans la langue que la question vous a été posée."

def load_messages(message_request: MessageRequest) -> List[ChatCompletionMessageParam]:
    messages: List[ChatCompletionMessageParam] = []

    # Check if the first message is a system prompt and add it if not
    if not message_request.messages or message_request.messages[0].role != "system":
        logger.info("Got no system prompt, will add one")
        messages.append(ChatCompletionSystemMessageParam(content=SYSTEM_PROMPT_EN if message_request.lang == 'en' else SYSTEM_PROMPT_FR, role="system"))
    else:
        messages.append(ChatCompletionSystemMessageParam(content=message_request.messages[0].content, role='system'))

    # Convert MessageRequest messages to ChatCompletionMessageParam
    for message in message_request.messages or []:
        logging.debug(message)
        if message.role == "user":
            messages.append(ChatCompletionUserMessageParam(content=message.content, role='user'))
        elif message.role == "assistant":
            messages.append(ChatCompletionAssistantMessageParam(content=message.content, role='assistant'))
        # Add other conditions if there are other roles like tools perhaps??

    # if messages is still one, meaning we didn't add a message it means query was passed via query str
    if len(messages) == 1:
        messages.append(ChatCompletionUserMessageParam(content=message_request.query, role='user'))

    # parameter message history via max attribute
    if len(messages) > message_request.max:
        messages = [messages[0]] + (messages[-(message_request.max-1):] if message_request.max > 1 else []) #else if 1 we end up with -0 wich is interpreted as 0: (whole list)
    return messages