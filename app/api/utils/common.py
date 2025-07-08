import json
import logging
from utils.openai import chat_with_data
from utils.models import MessageRequest, Message

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

    return f"{role}: {content}" if content else f"{role}: <empty>"

def summerizeChatWithChatGPT(chat: list) -> str:
    """
    Summarizes a chat conversation by merging all chat items (including system) and asking ChatGPT to generate a title.
    """
    if not chat:
        return ""

    # Merge all chat items, including system messages
    mergeChatItems = [mergeChatItem(item) for item in chat if item]

    if not mergeChatItems:
        return ""

    merged_text = "\n".join(mergeChatItems)
    prompt = (
        "Given the following conversation, generate a short less then 5 words, concise and descriptive title for it:\n\n"
        f"{merged_text}\n\nTitle:"
    )

    # Prepare the message for the OpenAI API
    messages = [Message(role="user", content=prompt)]
    # Provide appropriate values for 'query', 'quotedText', and 'model'
    message_request = MessageRequest(
        messages=messages,
        query=prompt,
        quotedText="",
        model="gpt-4o"  # Replace with your default model if different
    )

    _, completion = chat_with_data(message_request)
    # Extract the title from the completion response
    title = completion.choices[0].message.content if hasattr(completion.choices[0].message, "content") else ""
    return title.strip()