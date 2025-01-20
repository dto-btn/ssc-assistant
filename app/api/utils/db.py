import base64
import copy
import json
import logging
import os
import uuid
from typing import Any

from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

from .models import Completion, Feedback, FilePayload, MessageRequest

__all__ = ["store_request", "store_completion", "leave_feedback", "flag_conversation"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Use DefaultAzureCredential
credential = DefaultAzureCredential()
table_service_client = TableServiceClient(endpoint=os.getenv("DATABASE_ENDPOINT") or "", credential=credential)
chat_table_client = table_service_client.get_table_client(table_name="chat")
feedback_table_client = table_service_client.get_table_client(table_name="feedback")
flagged_client = table_service_client.get_table_client(table_name="flagged")
blob_service_client = BlobServiceClient(account_url=os.getenv("BLOB_ENDPOINT") or "", credential=credential)

def create_entity(data, partition_key: str, row_key_prefix: str, user: Any):
    '''
    Create entity that we will store in the database

    TODO: validate parition_key, if empty handle error.
    '''
    data_copy = copy.deepcopy(data)
    entity = dict()
    entity['PartitionKey'] = partition_key
    entity['RowKey'] = f"{row_key_prefix}-{uuid.uuid4()}"
    try:
        #https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
        if user and user.get('oid') and user.get('upn'):
            logger.debug("User information added to entity")
            entity['preferred_username'] = user['upn']
            entity['oid'] = user['oid']
        elif user and user.get('oid') and user.get('appid'):
            logger.debug("Application information added to entity")
            entity['preferred_username'] = user['appid']
            entity['oid'] = user['oid']
    except Exception as e:
        logger.error("Unable to add user information: %s", e)

    if isinstance(data_copy, Completion):
        entity['Answer'] = data_copy.message.content

    if isinstance(data_copy, MessageRequest) and data_copy.messages:
        msg = data_copy.messages[-1]
        data_copy.messages = [] #avoid saving the whole conversation (no need to)
        data_copy.messages = [msg] #avoid saving the whole conversation (no need to)
        logger.debug("question length is: %s", len(str(msg.content)))
        logger.debug("history length is: %s", len(data_copy.messages))
        entity['Question'] = msg.content

    entity[row_key_prefix] = json.dumps(
            data_copy.__dict__,
            default=lambda o: o.__dict__
    )

    return entity

def store_request(message_request: MessageRequest, conversation_uuid: str, user: Any):
    '''
    Store the conversation in the database, we store what we received (history and question) 
    NOTE: Azure Table storage offers a limit of 32k per column for string type of characters.
        one solution is to compress and split the data: https://github.com/mebjas/AzureStorageTableLargeDataWriter/blob/master/AzureStorageTableLargeDataWriter/StorageTableWriter.cs
    '''
    try:
        message_request_entity = create_entity(message_request, conversation_uuid, 'MessageRequest', user)
        chat_table_client.upsert_entity(message_request_entity)
    except Exception as e:
          logger.error(e)

def store_completion(completion: Completion, conversation_uuid: str, user: Any):
      '''
      Store the conversation in the database, we store the completion (answer)

      NOTE: Azure Table storage offers a limit of 32k per column for string type of characters.
            one solution is to compress and split the data: https://github.com/mebjas/AzureStorageTableLargeDataWriter/blob/master/AzureStorageTableLargeDataWriter/StorageTableWriter.cs
      '''
      try:
        completion_entity = create_entity(completion, conversation_uuid, 'Completion', user)
        chat_table_client.upsert_entity(completion_entity)
      except Exception as e:
          logger.error(e)

def leave_feedback(feedback: Feedback):
      '''
      Store the feedback in the database, we store what we received (history and question) and the completion (answer)
      '''
      try:
        convo_uuid = feedback.uuid if feedback.uuid else str(uuid.uuid4())
        feedback_entity = create_entity(feedback, convo_uuid, 'Feedback', None)
        feedback_table_client.upsert_entity(feedback_entity)
      except Exception as e:
          logger.error(e)

def flag_conversation(message_request: MessageRequest, conversation_uuid: str):
      '''
      Store the feedback in the database, we store what we received (history and question) and the completion (answer)
      '''
      try:
        message_request_entity = create_entity(message_request, conversation_uuid, 'MessageRequest', None)
        flagged_client.upsert_entity(message_request_entity)
      except Exception as e:
          logger.error(e)

def save_file(file: FilePayload) -> str:
    '''
    Store the feedback in the database, we store what we received (history and question) and the completion (answer)
    NOTE: We do not store the user here since the file tied to the user operation 
          is stored in a different table (history)
    Returns the blob storage url if successful
    '''
    file_name_uuid = str(uuid.uuid4()) + '-' + file.name
    blob_client = blob_service_client.get_blob_client(container="assistant-chat-files", blob=file_name_uuid)
    logger.info("Blob client created for container 'assistant-chat-files' and blob '%s'.", file_name_uuid)
    # encode file to bytes
    file_as_byte = base64.b64decode(file.encoded_file.split(",")[1])
    blob_client.upload_blob(file_as_byte, blob_type="BlockBlob", overwrite=True)
    return blob_client.url
