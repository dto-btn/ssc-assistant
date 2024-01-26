# Build index

Build the search services index and vectorize it.

## Documentation

[How to create a search services index from scratch with vectorization via code](https://github.com/Azure/azure-search-vector-samples/blob/main/demo-python/code/azure-search-integrated-vectorization-sample.ipynb)

## Troubleshooting

I had an issue where the trigger wasn't detected in the V2 model. I had to modify my `local.settings.json` to include this property ([see documentation about it](https://learn.microsoft.com/en-us/azure/azure-functions/create-first-function-vs-code-python?pivots=python-mode-decorators#update-app-settings)): 

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsFeatureFlags": "EnableWorkerIndexing",
    ...
  }
}
```