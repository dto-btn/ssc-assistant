import azure.functions as func
import logging
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.storage.blob import BlobServiceClient
import openai
from dotenv import load_dotenv
import os

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

# Configure environment variables
load_dotenv()
service_endpoint = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT")
index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
key = os.getenv("AZURE_SEARCH_ADMIN_KEY")
model: str = "text-embedding-ada-002"
blob_connection_string = os.getenv("BLOB_CONNECTION_STRING")
container_name = os.getenv("BLOB_CONTAINER_NAME")
credential = AzureKeyCredential(key)
model: str = "text-embedding-ada-002"


@app.route(route="build_index")
def build_index(req: func.HttpRequest) -> func.HttpResponse:
    """
    Implementing via this method to get started.
    https://github.com/Azure/azure-search-vector-samples/blob/main/demo-python/code/azure-search-vector-python-llamaindex-sample.ipynb
    """
    logging.info('Python HTTP trigger function processed a request.')

    name = req.params.get('name')
    if not name:
        try:
            req_body = req.get_json()
        except ValueError:
            pass
        else:
            name = req_body.get('name')

    # Connect to Blob Storage
    blob_service_client = BlobServiceClient.from_connection_string(blob_connection_string)
    container_client = blob_service_client.get_container_client(container_name)
    blobs = container_client.list_blobs()

    first_blob = next(blobs)
    blob_url = container_client.get_blob_client(first_blob).url
    logging.info(f"URL of the first blob: {blob_url}")

    if name:
        return func.HttpResponse(f"Hello, {name}. This HTTP triggered function executed successfully.")
    else:
        return func.HttpResponse(
             "This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.",
             status_code=200
        )