import base64
import logging
import os
from io import BytesIO
from typing import Iterable
from urllib.parse import urlparse

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from openai.types.chat.chat_completion_content_part_param import \
    ChatCompletionContentPartParam
from PIL import Image
from utils.models import Message

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

default_credential = DefaultAzureCredential()
blob_service_client = BlobServiceClient(account_url=os.getenv("BLOB_ENDPOINT") or "", credential=default_credential)

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
            try:
                image_bytes = _download_attachment(processed_url)
                encoded_image = _encode_image_to_base64(image_bytes)
                if attachment.type == "image":
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": encoded_image,
                                "detail": "auto" # would be interesting to parameterize this.
                            }
                        })
            except Exception as e:
                logger.error("Error processing attachment skipping: %s", e)

    return content

def _encode_image_to_base64(image_data: bytes, img_format: str = "JPEG") -> str:
    # Open the image using Pillow
    img = Image.open(BytesIO(image_data))

    # Step 3: Convert the image to JPEG
    with BytesIO() as buffer:
        img.convert('RGB').save(buffer, format=img_format)
        jpeg_image = buffer.getvalue()

    # Step 4: Encode the JPEG image in base64
    base64_encoded = base64.b64encode(jpeg_image).decode('utf-8')
    return f"data:image/jpeg;base64,{base64_encoded}"

def _download_attachment(url: str) -> bytes:
    """Download the attachment from the given URL and return the bytes"""
    _, container_name, blob_name = _parse_blob_url(url)
    blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
    blob_data = blob_client.download_blob()
    image_data = blob_data.readall()
    return image_data

def _parse_blob_url(blob_url):
    """Extracts the storage account, container, and blob name from the blob URL."""
    parsed_url = urlparse(blob_url)

    # Extract the storage account name from the URL
    storage_account = parsed_url.netloc.split('.')[0]

    # The path starts with a '/', so we need to strip it off
    path_parts = parsed_url.path.lstrip('/').split('/')
    container_name = path_parts[0]
    blob_name = '/'.join(path_parts[1:])

    return storage_account, container_name, blob_name
