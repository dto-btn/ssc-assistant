from dotenv import load_dotenv
import json  # bourne
import os
from azure.storage.blob import BlobServiceClient
import azure.functions as func
from datetime import datetime
import re

app = func.FunctionApp(http_auth_level=func.AuthLevel.FUNCTION)

load_dotenv()
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")


def get_latest_date(container_client):
    blob_list = container_client.list_blobs()
    
    dates = set()
    for blob in blob_list:
        parts = blob.name.split('/')
        
        date = datetime.strptime(parts[0], '%Y-%m-%d_%H:%M:%S')
        dates.add(date)
    
    if not dates:
        raise ValueError("No valid date folders found in the container.")
    
    latest_date = max(dates)
    return latest_date.strftime('%Y-%m-%d_%H:%M:%S')


def main():
    blob_service_client = BlobServiceClient.from_connection_string(str(blob_connection_string))
    container_name = "ssc-assistant-index-data"
    container_client = blob_service_client.get_container_client(container_name)

    # Can manually put in the path here as well if not looking for the latest
    folder_base_path = get_latest_date(container_client=container_client)

    # number of unique IDs
    ids_blob_name = f"{folder_base_path}/ids.json"
    blob_client = container_client.get_blob_client(ids_blob_name)
    blob_bytes = blob_client.download_blob().readall()
    blob_json = json.loads(blob_bytes)

    num_ids = len(blob_json)

    # get ids missing
    en_ids_uploaded = []
    fr_ids_uploaded = []

    pages_folder_path = f"{folder_base_path}/pages"
    blob_list = container_client.list_blobs(name_starts_with=pages_folder_path)

    for blob in blob_list:
        if "/en/" in blob.name:
            blob_name = blob.name.split('/')[-1]
            match = re.match(r"(\d+).json", blob_name)

            if match:
                 en_ids_uploaded.append(int(match.group(1)))

        if "/fr/" in blob.name:
            blob_name = blob.name.split('/')[-1]
            match = re.match(r"(\d+).json", blob_name)

            if match:
                fr_ids_uploaded.append(int(match.group(1)))

    print(f"RESULTS FOR {folder_base_path}\n")

    print('total unique pages :', num_ids, '\n')

    print(f"total en pages uploaded: {len(en_ids_uploaded)}")
    en_percentage = round((len(en_ids_uploaded) / num_ids), 3) * 100
    print(f"% of en pages uploaded: {en_percentage}\n")

    print(f"total fr pages uploaded: {len(fr_ids_uploaded)}")
    fr_percentage = round((len(fr_ids_uploaded) / num_ids), 3) * 100
    print(f"% of fr pages uploaded: {fr_percentage}")




if __name__ == "__main__":
    main()
