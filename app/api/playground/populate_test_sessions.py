"""
Playground Session Population Utility

This script generates mock chat sessions in Azure Blob Storage to help developers
test bulk-delete performance, sidebar scrolling, and session hydration logic.

Prerequisites:
- Ensure 'azure-storage-blob', 'azure-identity', and 'python-dotenv' are installed in your venv.
- Ensure your .env file in 'app/api/' contains either 'BLOB_ENDPOINT' or 
  'AZURE_STORAGE_CONNECTION_STRING'.
- Authenticate with Azure CLI ('az login') if using 'BLOB_ENDPOINT'.

Environment Variables:
- TEST_USER_OID: (Recommended) Set this in .env to your AAD Object ID (find it using 
  'az ad signed-in-user show --query id -o tsv') so the chats appear in your browser.

Usage:
    cd app/api
    .venv/bin/python playground/populate_test_sessions.py

The script will create 200 sessions, each containing a user message and an 
assistant response.
"""

import os
import uuid
import datetime
import json
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContentSettings
from dotenv import load_dotenv

# Set target OID for testing.
load_dotenv()
TEST_OID = os.getenv("TEST_USER_OID")
CONTAINER_NAME = "assistant-chat-files-v2"
NUM_SESSIONS = 200

def populate_test_sessions():
    if not TEST_OID:
        print("Error: TEST_USER_OID not found in .env. Please add it to see chats in your session.")
        return

    connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    blob_endpoint = os.getenv("BLOB_ENDPOINT")
    
    if connection_string:
        blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    elif blob_endpoint:
        blob_service_client = BlobServiceClient(blob_endpoint, credential=DefaultAzureCredential())
    else:
        print("Error: AZURE_STORAGE_CONNECTION_STRING or BLOB_ENDPOINT not found in environment.")
        return

    container_client = blob_service_client.get_container_client(CONTAINER_NAME)

    try:
        container_client.create_container()
    except Exception:
        pass

    print(f"Populating {NUM_SESSIONS} sessions for OID: {TEST_OID}...")

    for i in range(NUM_SESSIONS):
        session_id = str(uuid.uuid4())
        session_name = f"Test Session {i+1}"
        timestamp = datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z")
        
        # Create a mock chat history blob with a pair of messages
        blob_name = f"{TEST_OID}/{session_id}.chat.json"
        chat_data = {
            "messages": [
                {
                    "id": str(uuid.uuid4()),
                    "sessionId": session_id,
                    "role": "user",
                    "content": f"Hello, this is test session {i+1}",
                    "timestamp": int(datetime.datetime.now(datetime.UTC).timestamp() * 1000)
                },
                {
                    "id": str(uuid.uuid4()),
                    "sessionId": session_id,
                    "role": "assistant",
                    "content": "I am a test assistant responding to your query.",
                    "timestamp": int(datetime.datetime.now(datetime.UTC).timestamp() * 1000) + 1000
                }
            ]
        }
        content = json.dumps(chat_data).encode("utf-8")
        metadata = {
            "user_id": TEST_OID,
            "sessionid": session_id,
            "sessionname": session_name,
            "originalname": f"{session_id}.chat.json",
            "uploadedat": timestamp,
            "lastupdated": timestamp,
            "category": "chat",
            "deleted": "false",
            "type": "chat-archive"
        }
        
        blob_client = container_client.get_blob_client(blob_name)
        # Clear existing metadata entirely to remove 'deletedat' if it exists from previous tests
        blob_client.upload_blob(
            content, 
            overwrite=True, 
            metadata=metadata,
            content_settings=ContentSettings(content_type="application/json")
        )
        
        if (i + 1) % 20 == 0:
            print(f"Uploaded {i + 1}/{NUM_SESSIONS}...")

    print("Success: Population complete.")

if __name__ == "__main__":
    populate_test_sessions()
