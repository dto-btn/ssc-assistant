from typing import Iterable

from utils.models import Message
from openai.types.chat.chat_completion_content_part_param import ChatCompletionContentPartParam

__all__ = ["map_attachments"]

def map_attachments(message: Message):
    """
    This will map attachments so it can be read directly from the OpenAI API. API will accept the following structure:

    {
    "messages": [
      {
        "role": "system",
        "content": [
          {
            "type": "text",
            "text": "You are an AI assistant that helps people find information."
          }
        ]
      },
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "\n"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": f"data:image/jpeg;base64,{encoded_image}"
            }
          },
          {
            "type": "text",
            "text": "What is this image?"
          }
        ]
      },
      {
        "role": "assistant",
        "content": [
          {
            "type": "text",
            "text": "This image shows two app icons on a mobile device. ...."
          }
        ]
      }
    ],
    """
    content: Iterable[ChatCompletionContentPartParam] = []
    if message.content: #if we have a standard message along with the attachment(s) add it.
        content.append(
            {
                "type": "text",
                "text": message.content
            })
    if message.attachments:
        for attachment in message.attachments:
            processed_url = attachment.blob_storage_url
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": processed_url,
                        "detail": "auto" # would be interesting to parameterize this.
                    }
                })

    return content
