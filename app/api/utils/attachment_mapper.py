import base64
from io import BytesIO
from typing import Iterable

import requests
from openai.types.chat.chat_completion_content_part_param import \
    ChatCompletionContentPartParam
from PIL import Image
from utils.models import Message

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
            if attachment.type == "image": # yikes?
                content.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": _encode_image_to_base64(processed_url),
                            "detail": "auto" # would be interesting to parameterize this.
                        }
                    })

    return content

def _encode_image_to_base64(url: str, img_format: str = "JPEG") -> str:
    # Step 1: Download the image from the URL
    response = requests.get(url, timeout=5)
    response.raise_for_status()  # Ensure the request was successful

    # Step 2: Open the image using Pillow
    img = Image.open(BytesIO(response.content))

    # Step 3: Convert the image to JPEG
    with BytesIO() as buffer:
        img.convert('RGB').save(buffer, format=img_format)
        jpeg_image = buffer.getvalue()

    # Step 4: Encode the JPEG image in base64
    base64_encoded = base64.b64encode(jpeg_image).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_encoded}"
