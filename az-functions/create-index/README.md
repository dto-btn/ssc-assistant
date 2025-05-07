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

### Custom Indices

#### PMCoE

```json
{
  "@odata.etag": "\"0x8DD8D57EF30FFB8\"",
  "name": "pmcoe",
  "fields": [
    {
      "name": "chunk_id",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "retrievable": true,
      "stored": true,
      "sortable": true,
      "facetable": false,
      "key": true,
      "analyzer": "keyword",
      "synonymMaps": []
    },
    {
      "name": "parent_id",
      "type": "Edm.String",
      "searchable": false,
      "filterable": true,
      "retrievable": true,
      "stored": true,
      "sortable": false,
      "facetable": false,
      "key": false,
      "synonymMaps": []
    },
    {
      "name": "chunk",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "retrievable": true,
      "stored": true,
      "sortable": false,
      "facetable": false,
      "key": false,
      "synonymMaps": []
    },
    {
      "name": "title",
      "type": "Edm.String",
      "searchable": true,
      "filterable": false,
      "retrievable": true,
      "stored": true,
      "sortable": false,
      "facetable": false,
      "key": false,
      "synonymMaps": []
    },
    {
      "name": "text_vector",
      "type": "Collection(Edm.Single)",
      "searchable": true,
      "filterable": false,
      "retrievable": true,
      "stored": true,
      "sortable": false,
      "facetable": false,
      "key": false,
      "dimensions": 3072,
      "vectorSearchProfile": "pmcoe-azureOpenAi-text-profile",
      "synonymMaps": []
    },
    {
      "name": "langcode",
      "type": "Edm.String",
      "searchable": true,
      "filterable": true,
      "retrievable": true,
      "stored": true,
      "sortable": false,
      "facetable": false,
      "key": false,
      "synonymMaps": []
    }
  ],
  "scoringProfiles": [],
  "suggesters": [],
  "analyzers": [],
  "normalizers": [],
  "tokenizers": [],
  "tokenFilters": [],
  "charFilters": [],
  "similarity": {
    "@odata.type": "#Microsoft.Azure.Search.BM25Similarity"
  },
  "semantic": {
    "defaultConfiguration": "pmcoe-semantic-configuration",
    "configurations": [
      {
        "name": "pmcoe-semantic-configuration",
        "flightingOptIn": false,
        "prioritizedFields": {
          "titleField": {
            "fieldName": "title"
          },
          "prioritizedContentFields": [
            {
              "fieldName": "chunk"
            }
          ],
          "prioritizedKeywordsFields": []
        }
      }
    ]
  },
  "vectorSearch": {
    "algorithms": [
      {
        "name": "pmcoe-algorithm",
        "kind": "hnsw",
        "hnswParameters": {
          "metric": "cosine",
          "m": 4,
          "efConstruction": 400,
          "efSearch": 500
        }
      }
    ],
    "profiles": [
      {
        "name": "pmcoe-azureOpenAi-text-profile",
        "algorithm": "pmcoe-algorithm",
        "vectorizer": "pmcoe-azureOpenAi-text-vectorizer"
      }
    ],
    "vectorizers": [
      {
        "name": "pmcoe-azureOpenAi-text-vectorizer",
        "kind": "azureOpenAI",
        "azureOpenAIParameters": {
          "resourceUri": "https://scsc-cio-ect-openai-oai.openai.azure.com",
          "deploymentId": "text-embedding-3-large",
          "modelName": "text-embedding-3-large"
        }
      }
    ],
    "compressions": []
  }
}
```

Indexer: 

```json
{
  "@odata.context": "https://ssc-assistant-search-service.search.windows.net/$metadata#indexers/$entity",
  "@odata.etag": "\"0x8DD8D5D178AACBF\"",
  "name": "pmcoe-indexer",
  "description": null,
  "dataSourceName": "pmcoe-datasource",
  "skillsetName": "pmcoe-skillset",
  "targetIndexName": "pmcoe",
  "disabled": null,
  "schedule": null,
  "parameters": {
    "batchSize": null,
    "maxFailedItems": null,
    "maxFailedItemsPerBatch": null,
    "configuration": {
      "dataToExtract": "contentAndMetadata",
      "parsingMode": "default"
    }
  },
  "fieldMappings": [
    {
      "sourceFieldName": "metadata_storage_name",
      "targetFieldName": "title",
      "mappingFunction": null
    }
  ],
  "outputFieldMappings": [],
  "cache": null,
  "encryptionKey": null
}
```

## Maintenance

For the versioning in the `requirements.txt` file we use this command: `pip freeze -r requirements.txt|grep -i -f <(awk '{print $1}' requirements.txt) > requirements_with_versions.txt`