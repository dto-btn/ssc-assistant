import logging
import os

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

default_credential = DefaultAzureCredential()
blob_service_client = BlobServiceClient(account_url=os.getenv("BLOB_ENDPOINT") or "", credential=default_credential)

def get_blob_service_client() -> BlobServiceClient:
    """Return the BlobServiceClient instance."""
    return blob_service_client
