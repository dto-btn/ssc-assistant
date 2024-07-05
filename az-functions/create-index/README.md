# Fetch Search Index Data

## Developpment

```bash
cd ssc-assitant/az-functions/create-index
source .venv_func/bin/activate #create .venv first if missing ..
pip install -r requirements.txt 
```

Create a `.env` file and populate it with the necessary keys: 

```
AZURE_SEARCH_SERVICE_ENDPOINT=https://<domain>.search.windows.net
DOMAIN_NAME=<domain>
AZURE_SEARCH_ADMIN_KEY=<INSERT_KEY_HERE>
BLOB_CONTAINER_NAME=sscplus-index-data
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

Steps:
1. Deploy the function to dev-index-mgmt Function App
2. Trigger the function from postman with the following URL:

`
"https://dev-index-mgmt.azurewebsites.net/api/orchestrators/fetch_index_data?code=<code>"
`

## Maintenance

For the versioning in the `requirements.txt` file we use this command: `pip freeze -r requirements.txt|grep -i -f <(awk '{print $1}' requirements.txt) > requirements_with_versions.txt`