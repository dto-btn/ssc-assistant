from datetime import datetime
from dotenv import load_dotenv
import json  # bourne
import logging
import os
import requests
from azure.storage.blob import BlobServiceClient
import azure.functions as func
import azure.durable_functions as df
from tenacity import retry, stop_after_attempt, wait_fixed

app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)

load_dotenv()
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")
all_ids_url = os.getenv("ALL_PAGE_IDS_ENDPOINT")
domain = str(os.getenv("DOMAIN_NAME"))

blob_service_client = BlobServiceClient.from_connection_string(str(blob_connection_string))
container_name = 'ssc-assistant-index-data'

# Durable function that fetches all sscplus page IDs/pages and uploads them
@app.route(route="orchestrators/{functionName}")
@app.durable_client_input(client_name="client")
async def http_start(req: func.HttpRequest, client):
    function_name = req.route_params.get('functionName')
    instance_id = await client.start_new(function_name)
    response = client.create_check_status_response(req, instance_id)
    return response

# Orchestrator
@app.orchestration_trigger(context_name="context")
def fetch_index_data(context):
    blob_path = f"{datetime.now().strftime('%Y-%m-%d_%H:%M:%S')}"
    pages = yield context.call_activity("get_and_save_ids", blob_path)

    get_and_save_page_tasks = []
    for page in pages:
        get_and_save_page_tasks.append(context.call_activity("get_and_save_pages", page))

    # task the function to run the get_and_save_page tasks
    yield context.task_all(get_and_save_page_tasks)

    return f"Finished downloading (or trying to ..): {len(get_and_save_page_tasks)} page(s)"


# Activity
@app.activity_trigger(input_name="blobPath")
def get_and_save_ids(blobPath: str):
    pages = []

    try:
        url = f"{domain}/en/rest/all-ids"
        res = requests.get(url, verify=False)
        res.raise_for_status()

        container = blob_service_client.get_container_client(container_name)
        if not container.exists():
            container.create_container()

        blob_client = blob_service_client.get_blob_client(container_name, f"{blobPath}/ids.json")
        blob_client.upload_blob(json.dumps(res.json()).encode('utf-8'), overwrite=True)

        data = res.json()

        for d in data:
            # add both pages here, en/fr versions
            pages.append({"id": d["nid"], "type": d["type"], "url": f"{domain}/en/rest/page-by-id/{d['nid']}", "blob_name": f"{blobPath}/pages/{d['type']}/en/{d['nid']}.json"})
            pages.append({"id": d["nid"], "type": d["type"], "url": f"{domain}/fr/rest/page-by-id/{d['nid']}", "blob_name": f"{blobPath}/pages/{d['type']}/fr/{d['nid']}.json"})

        return pages

    except requests.exceptions.RequestException as e:
        print(f"An error occurred fetching the ids: {e}")
        return []


# Activity
@app.activity_trigger(input_name="page")
def get_and_save_pages(page: dict):
    try:
        _get_and_save(page['url'], page['blob_name'])
        return True

    except requests.exceptions.RequestException as e:
        logging.error("Unable to download separate page file. Error:" + str(e))
        return False


# retry needed to help with some of the connection errors we get when
# fetching pages from the Drupal API, but still need a net to catch missing ids.
@retry(stop=stop_after_attempt(5), wait=wait_fixed(3))
def _get_and_save(url, blob_name):
    response = requests.get(url, verify=False)
    blob_client = blob_service_client.get_blob_client(container_name, blob_name)
    blob_client.upload_blob(json.dumps(response.json()).encode('utf-8'), overwrite=True)

    return response.json()
