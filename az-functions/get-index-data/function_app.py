from datetime import datetime
from dotenv import load_dotenv
import json  # bourne
import logging
import os
import requests
from azure.storage.blob import BlobServiceClient
import azure.functions as func
from azure.functions import TimerRequest
import azure.durable_functions as df
from tenacity import retry, stop_after_attempt, wait_fixed

app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)

load_dotenv()
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")
all_ids_url = os.getenv("ALL_PAGE_IDS_ENDPOINT")
domain = str(os.getenv("DOMAIN_NAME"))

blob_service_client = BlobServiceClient.from_connection_string(str(blob_connection_string))
container_name = 'sscplus-index-data'

# Durable function that fetches all sscplus page IDs/pages and uploads them
# @app.route(route="orchestrators/{functionName}")
# @app.durable_client_input(client_name="client")
# async def http_start(req: func.HttpRequest, client):
#     function_name = req.route_params.get('functionName')
#     instance_id = await client.start_new(function_name)
#     response = client.create_check_status_response(req, instance_id)
#     return response

# timer triggered:
@app.schedule(schedule="0 * * * *", arg_name="myTimer", run_on_startup=False, use_monitor=False)
@app.durable_client_input(client_name="client") 
async def timer_trigger(myTimer: func.TimerRequest, client) -> None: 
    if myTimer.past_due: 
        logging.info("The timer is past due") 
    instance_id = await client.start_new("fetch_index_data") 
    logging.info("python timer trigger function executed")

# Orchestrator
@app.orchestration_trigger(context_name="context")
def fetch_index_data(context):
    blobPath = f"{datetime.now().strftime('%Y-%m-%d_%H:%M:%S')}"
    pages = yield context.call_activity("get_and_save_ids", blobPath)

    get_and_save_page_tasks = [
        context.call_activity("get_and_save_pages", page) 
        for page in pages
    ]

    # task the function to run the get_and_save_page tasks
    pages_not_downloaded = yield context.task_all(get_and_save_page_tasks)

    # filter only for the pages not downloaded
    pages_not_downloaded = [page for page in pages_not_downloaded if page is not None]

    retry_counter = 0
    while retry_counter < 6 and len(pages_not_downloaded) > 0:
        logging.info(f"Retry attempt {retry_counter + 1}: {len(pages_not_downloaded)} pages not downloaded.")

        retry_counter+=1
        retry_tasks = [
            context.call_activity("get_and_save_pages", page)
            for page in pages_not_downloaded
        ]
        
        pages_not_downloaded.clear()
        pages_not_downloaded = yield context.task_all(retry_tasks)
        pages_not_downloaded = [page for page in pages_not_downloaded if page is not None]
    
    for page in pages_not_downloaded:
        logging.info(f"PAGE NOT DOWNLOADED: {page['blob_name']}")

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
            pages.append({
                "id": d["nid"], 
                "type": d["type"], 
                "url": f"{domain}/en/rest/page-by-id/{d['nid']}", 
                "blob_name": f"{blobPath}/pages/{d['type']}/en/{d['nid']}.json"
            })
            pages.append({
                "id": d["nid"], 
                "type": d["type"], 
                "url": f"{domain}/fr/rest/page-by-id/{d['nid']}", 
                "blob_name": f"{blobPath}/pages/{d['type']}/fr/{d['nid']}.json"
            })

        return pages

    except requests.exceptions.RequestException as e:
        print(f"An error occurred fetching the ids: {e}")
        return []


# Activity
@retry(stop=stop_after_attempt(5), wait=wait_fixed(3))
@app.activity_trigger(input_name="page")
def get_and_save_pages(page: dict):
    try:
        _get_and_save(page['url'], page['blob_name'])
        return None

    except requests.exceptions.RequestException as e:
        logging.error("Unable to download separate page file. Error:" + str(e))
        return page


# retry needed to help with some of the connection errors we get when
# fetching pages from the Drupal API, but still need a net to catch missing ids.
def _get_and_save(url, blob_name):
    response = requests.get(url, verify=False)
    blob_client = blob_service_client.get_blob_client(container_name, blob_name)
    blob_client.upload_blob(json.dumps(response.json()).encode('utf-8'), overwrite=True)

    return response.json()
