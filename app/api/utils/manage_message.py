import logging
from typing import Any, List

from openai.types.chat import (ChatCompletionAssistantMessageParam,
                               ChatCompletionMessageParam,
                               ChatCompletionSystemMessageParam,
                               ChatCompletionUserMessageParam)
from utils.models import MessageRequest

logger = logging.getLogger(__name__)

__all__ = ["load_messages"]

SYSTEM_PROMPT_EN = """You are a versatile assistant for Shared Services Canada (SSC) employees, designed to provide comprehensive support for both work-related requests and general knowledge questions.

For SSC-specific inquiries, you have direct access to the intranet MySSC+ website data and can utilize contextual data from that website to deliver accurate answers. Additionally, you can access corporate tools like GEDS to find detailed information about employees.

Beyond SSC-related matters, you are equipped with a broad understanding of various topics and can provide insights into a wide array of questions, whether they be scientific, historical, cultural, or practical in nature.

When responding to queries, you may reference a list of tools or functions that were invoked along with the response from the designated system to provide a more informed answer."""

SYSTEM_PROMPT_FR = """Vous êtes un assistant polyvalent pour les employés de Services partagés Canada (SPC), conçu pour fournir un soutien complet tant pour les demandes liées au travail que pour les questions de connaissance générale.

Pour les demandes spécifiques à SPC, vous avez un accès direct aux données du site intranet MonSSC+ et pouvez utiliser des données contextuelles de ce site pour fournir des réponses précises. De plus, vous pouvez accéder à des outils corporatifs tels que SAGE pour trouver des informations détaillées sur les employés.

Au-delà des questions liées à SPC, vous êtes doté d'une large compréhension de divers sujets et pouvez fournir des aperçus sur un large éventail de questions, qu'elles soient scientifiques, historiques, culturelles ou pratiques.

Lorsque vous répondez aux requêtes, vous pouvez référencer une liste d'outils ou de fonctions qui ont été invoqués ainsi que la réponse du système désigné pour fournir une réponse plus informée."""

def load_messages(message_request: MessageRequest) -> List[ChatCompletionMessageParam]:
    messages: List[ChatCompletionMessageParam] = []

    # Check if the first message is a system prompt and add it if not
    if not message_request.messages or message_request.messages[0].role != "system":
        logger.info("Got no system prompt, will add one")
        messages.append(ChatCompletionSystemMessageParam(content=SYSTEM_PROMPT_EN if message_request.lang == 'en' else SYSTEM_PROMPT_FR, role="system"))
    else:
        messages.append(ChatCompletionSystemMessageParam(content=str(message_request.messages[0].content), role='system'))

    # Convert MessageRequest messages to ChatCompletionMessageParam
    for message in message_request.messages or []:
        logging.debug(message)
        if message.role == "user":
            messages.append(ChatCompletionUserMessageParam(content=str(message.content), role='user'))
        elif message.role == "assistant":
            messages.append(ChatCompletionAssistantMessageParam(content=message.content, role='assistant'))
        # Add other conditions if there are other roles like tools perhaps??

    # if messages is still one, meaning we didn't add a message it means query was passed via query str
    if len(messages) == 1:
        messages.append(ChatCompletionUserMessageParam(content=str(message_request.query), role='user'))
    
    # parameter message history via max attribute
    max = min(message_request.max, 20)
    if len(messages) - 1 > max:
        messages = [messages[0]] + (messages[-(max-1):] if max > 1 else []) #else if 1 we end up with -0 wich is interpreted as 0: (whole list)

    return messages