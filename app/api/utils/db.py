import os
import json
import logging
from azure.data.tables import TableServiceClient
from azure.identity import DefaultAzureCredential
import uuid
import copy

from utils.models import Completion, Feedback, MessageRequest

__all__ = ["store_request", "store_completion", "leave_feedback", "flag_conversation"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

# Use DefaultAzureCredential
credential = DefaultAzureCredential()
table_service_client = TableServiceClient(endpoint=os.getenv("DATABASE_ENDPOINT") or "", credential=credential)
chat_table_client = table_service_client.get_table_client(table_name="chat")
feedback_table_client = table_service_client.get_table_client(table_name="feedback")
flagged_client = table_service_client.get_table_client(table_name="flagged")

def create_entity(data, partition_key: str, row_key_prefix: str):
    '''
    Create entity that we will store in the database

    TODO: validate parition_key, if empty handle error.
    '''
    data_copy = copy.deepcopy(data)
    entity = dict()
    entity['PartitionKey'] = partition_key
    entity['RowKey'] = f"{row_key_prefix}-{uuid.uuid4()}"

    if isinstance(data_copy, Completion):
        entity['Answer'] = data_copy.message.content
    
    if isinstance(data_copy, MessageRequest) and data_copy.messages:
        msg = data_copy.messages[-1]
        data_copy.messages = [] #avoid saving the whole conversation (no need to)
        logger.debug(f"question length is: {len(str(msg.content))}")
        logger.debug(f"history length is: {len(data_copy.messages)}")
        entity['Question'] = msg.content

    entity[row_key_prefix] = json.dumps(
            data_copy.__dict__,
            default=lambda o: o.__dict__
    )

    return entity

def store_request(message_request: MessageRequest, conversation_uuid: str):
      '''
      Store the conversation in the database, we store what we received (history and question) 

      NOTE: Azure Table storage offers a limit of 32k per column for string type of characters.
            one solution is to compress and split the data: https://github.com/mebjas/AzureStorageTableLargeDataWriter/blob/master/AzureStorageTableLargeDataWriter/StorageTableWriter.cs
      '''
      try:
        message_request_entity = create_entity(message_request, conversation_uuid, 'MessageRequest')
        chat_table_client.upsert_entity(message_request_entity)
      except Exception as e:
          logger.error(e)

def store_completion(completion: Completion, conversation_uuid: str):
      '''
      Store the conversation in the database, we store the completion (answer)

      NOTE: Azure Table storage offers a limit of 32k per column for string type of characters.
            one solution is to compress and split the data: https://github.com/mebjas/AzureStorageTableLargeDataWriter/blob/master/AzureStorageTableLargeDataWriter/StorageTableWriter.cs
      '''
      try:
        completion_entity = create_entity(completion, conversation_uuid, 'Completion')
        chat_table_client.upsert_entity(completion_entity)
      except Exception as e:
          logger.error(e)

def leave_feedback(feedback: Feedback):
      '''
      Store the feedback in the database, we store what we received (history and question) and the completion (answer)
      '''
      try:
        convo_uuid = feedback.uuid if feedback.uuid else str(uuid.uuid4())
        feedback_entity = create_entity(feedback, convo_uuid, 'Feedback')
        feedback_table_client.upsert_entity(feedback_entity)
      except Exception as e:
          logger.error(e)

def flag_conversation(message_request: MessageRequest, conversation_uuid: str):
      '''
      Store the feedback in the database, we store what we received (history and question) and the completion (answer)
      '''
      try:
        message_request_entity = create_entity(message_request, conversation_uuid, 'MessageRequest')
        flagged_client.upsert_entity(message_request_entity)
      except Exception as e:
          logger.error(e)