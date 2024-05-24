# Build index

Build the search services index and vectorize it.

## Developpment

```bash
cd ssc-assitant/az-functions/get-index-data
source .venv/bin/activate #create .venv first if missing ..
pip install -r requirements.txt 
```

Create a `.env` file and populate it with the necessary keys: 

```
AZURE_SEARCH_SERVICE_ENDPOINT=https://<domain>.search.windows.net
DOMAIN_NAME=<domain>
AZURE_SEARCH_ADMIN_KEY=<INSERT_KEY_HERE>
BLOB_CONTAINER_NAME=ssc-assistant-index-data
AZURE_OPENAI_ENDPOINT=https://<domain>.openai.azure.com/
AZURE_OPENAI_API_KEY=<INSERT_KEY_HERE>
BLOB_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=sscplusdatastorage;AccountKey=<INSERT_KEY_HERE>;EndpointSuffix=core.windows.net
```

Create a `local.settings.json` and put the following content inside: 

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "EnableWorkerIndexing",
    "FUNCTIONS_WORKER_RUNTIME": "python",
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing"
  }
}
```

## Documentation

[How to create a search services index from scratch with vectorization via code](https://github.com/Azure/azure-search-vector-samples/blob/main/demo-python/code/azure-search-integrated-vectorization-sample.ipynb)