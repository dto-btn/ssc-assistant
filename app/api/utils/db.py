import os
import json
import logging
from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential
import uuid

from utils.models import Completion, Feedback, MessageRequest

__all__ = ["store_conversation", "leave_feedback"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Use DefaultAzureCredential
credential = DefaultAzureCredential()
table_service_client = TableServiceClient(endpoint=os.getenv("DATABASE_ENDPOINT") or "", credential=credential)
chat_table_client = table_service_client.get_table_client(table_name="chat")
feedback_table_client = table_service_client.get_table_client(table_name="feedback")

def create_entity(data, partition_key: str, row_key_prefix: str):
    '''
    Create entity that we will store in the database

    TODO: validate parition_key, if empty handle error.
    '''
    entity = dict()
    entity['PartitionKey'] = partition_key
    entity['RowKey'] = f"{row_key_prefix}-{uuid.uuid4()}"

    if isinstance(data, Completion):
        entity['Answer'] = data.message.content
    
    if isinstance(data, MessageRequest) and data.messages:
        msg = data.messages[-1]
        data.messages = [] #avoid saving the whole conversation (no need to)
        logger.debug(f"question length is: {len(str(msg.content))}")
        logger.debug(f"history length is: {len(data.messages)}")
        entity['Question'] = msg.content

    entity[row_key_prefix] = json.dumps(
            data.__dict__,
            default=lambda o: o.__dict__
    )

    return entity

def store_conversation(message_request: MessageRequest, completion: Completion, conversation_uuid: str):
      '''
      Store the conversation in the database, we store what we received (history and question) and the completion (answer)

      NOTE: Azure Table storage offers a limit of 32k per column for string type of characters.
            one solution is to compress and split the data: https://github.com/mebjas/AzureStorageTableLargeDataWriter/blob/master/AzureStorageTableLargeDataWriter/StorageTableWriter.cs
      '''
      try:
        message_request_entity = create_entity(message_request, conversation_uuid, 'MessageRequest')
        completion_entity = create_entity(completion, conversation_uuid, 'Completion')

        chat_table_client.upsert_entity(message_request_entity)
        chat_table_client.upsert_entity(completion_entity)
      except Exception as e:
          logger.error(e)

def leave_feedback(feedback: Feedback, conversation_uuid: str):
      '''
      Store the feedback in the database, we store what we received (history and question) and the completion (answer)
      '''
      try:
        feedback_entity = create_entity(feedback, conversation_uuid, 'Feedback')
        feedback_table_client.upsert_entity(feedback_entity)
      except Exception as e:
          logger.error(e)
