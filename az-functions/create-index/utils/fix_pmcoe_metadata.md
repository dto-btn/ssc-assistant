# fix_pmcoe_metadata

Verifies and fixes `langcode` metadata on blobs in Azure Blob Storage. Expects a container with `en/` and `fr/` root folders — each blob must have a metadata key `langcode` matching its root folder.

## Prerequisites

- Python 3.10+
- `azure-identity` and `azure-storage-blob` packages (already in `requirements.txt`)
- Authenticated via `az login --use-device-code` (or any method supported by `DefaultAzureCredential`)

## Usage

```bash
cd az-functions/create-index

# Dry run — preview what would be fixed without making changes
python utils/fix_pmcoe_metadata.py \
  --account-url https://<storage-account>.blob.core.windows.net \
  --container <container-name> \
  --directory <optional-base-prefix> \
  --dry-run

# Apply fixes
python utils/fix_pmcoe_metadata.py \
  --account-url https://<storage-account>.blob.core.windows.net \
  --container <container-name> \
  --directory <optional-base-prefix>
```

## Arguments

| Argument         | Required | Description                                                        |
|------------------|----------|--------------------------------------------------------------------|
| `--account-url`  | Yes      | Azure Storage account URL                                          |
| `--container`    | Yes      | Blob container name                                                |
| `--directory`    | No       | Base directory prefix within the container (e.g. `pmcoe/documents`)|
| `--dry-run`      | No       | Report mismatches without writing any changes                      |

## Programmatic usage

```python
from utils.fix_pmcoe_metadata import fix_pmcoe_metadata

result = fix_pmcoe_metadata(
    account_url="https://mystorageaccount.blob.core.windows.net",
    container_name="pmcoe-data",
    directory="some/path",
)
# result = {"verified": 42, "fixed": 3, "skipped": 0, "errors": 0}
```

## What it does

1. Connects to Azure Blob Storage using `DefaultAzureCredential`.
2. Lists all blobs under `<directory>/en/` and `<directory>/fr/`.
3. For each blob, checks the `langcode` metadata key:
   - **Correct** → counted as `verified`.
   - **Missing or mismatched** → sets `langcode` to the root folder name (`en` or `fr`) and counts as `fixed`.
   - **Error** → logs the exception and counts as `errors`.
4. Returns (or prints) a summary of actions taken.
