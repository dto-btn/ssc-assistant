import json
import logging
from utils.openai import chat_with_data
from utils.models import MessageRequest, Message
from utils.manage_message import SUMMERIZECHATWITHCHATGPT_MESSAGE

def mergeChatItem(chat_item: dict) -> str:
    """
    Merges a chat item into a string format for logging or display.
    """
    if not chat_item:
        return ""

    role = chat_item.get("role", "unknown")
    content = chat_item.get("content", "")
    if isinstance(content, dict):
        content = json.dumps(content, ensure_ascii=False)
    elif isinstance(content, list):
        content = "\n".join(str(item) for item in content)
    elif not isinstance(content, str):
        content = str(content)
    if not isinstance(role, str):
        role = str(role)
    # Skip chat items with unknown role or empty content
    if role == "unknown" or not content or not content.strip():
        return ""
    content = content.strip()
    return f"{role}: {content}"

def summerizeChatWithChatGPT(chat: list) -> str:
    """
    Summarizes a chat conversation by merging all chat items (including system) and asking ChatGPT to generate a concise, descriptive title.
    """
    if not chat:
        return ""

    # Merge all chat items, including system messages
    mergeChatItems = [mergeChatItem(item) for item in chat if item]

    if not mergeChatItems:
        return ""

    merged_text = "\n".join(mergeChatItems)
    prompt = (
        f"{SUMMERIZECHATWITHCHATGPT_MESSAGE}:\n\n{merged_text}"
    )

    messages = [Message(role="user", content=prompt)]
    message_request = MessageRequest(
        messages=messages,
        query=prompt,
        quotedText="",
        model="gpt-4o"
    )

    _, completion = chat_with_data(message_request)
    # Extract the title from the completion response
    title = ""
    try:
        content = completion.choices[0].message.content if hasattr(completion.choices[0].message, "content") else ""
        # Post-process: take first line, strip quotes and whitespace
        if content:
            title = content.strip().split("\n")[0]
            title = title.strip(' "\'')
    except Exception as e:
        logging.warning(f"Failed to extract title from completion: {e}")
        title = ""
    return title