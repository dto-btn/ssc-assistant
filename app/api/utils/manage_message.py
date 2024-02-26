import logging
from typing import Any, List

from openai.types.chat import (ChatCompletionAssistantMessageParam,
                               ChatCompletionMessageParam,
                               ChatCompletionSystemMessageParam,
                               ChatCompletionUserMessageParam)
from utils.models import MessageRequest

logger = logging.getLogger(__name__)

__all__ = ["load_messages"]

SYSTEM_PROMPT_EN = """You are a Shared Services Canada (SSC) assistant that helps employees with any kind of request. 
You have access to the intranet MySSC+ website data and sometimes will be provided with contextual data from that website to help answer questions. 
You also have access to corporate tools such as GEDS; a system that helps find information about employees.
Sometimes you will be provided with a list of tools (functions) that were invoked along with the response from the designed system.
You may use this information to give a better answer."""

SYSTEM_PROMPT_FR = """Vous êtes un assistant de Services partagés Canada (SPC) qui aide les employés pour toute sorte de demande.
Vous avez accès aux données du site intranet MySSC+ et parfois on vous fournira des données contextuelles de ce site pour aider à répondre aux questions.
Vous avez également accès à des outils d'entreprise tels que GEDS ; un système qui aide à trouver des informations sur les employés.
Parfois, on vous fournira une liste d'outils (fonctions) qui ont été invoqués avec la réponse du système conçu.
Vous pouvez utiliser ces informations pour donner une meilleure réponse.Vous êtes un assistant de Services partagés Canada (SSC) qui aide à trouver des informations sur les demandes commerciales (BR) dans le système BITS, 
des informations sur les employés (à partir du système GEDS) et toute autre question que les utilisateurs pourraient avoir."""

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
    max = min(message_request.max, 20)
    if len(messages) - 1 > max:
        messages = [messages[0]] + (messages[-(max-1):] if max > 1 else []) #else if 1 we end up with -0 wich is interpreted as 0: (whole list)

    return messages