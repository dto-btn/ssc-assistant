#!/usr/bin/env python3
"""
Add a langcode metadata key to blobs under 'en/' and 'fr/' virtual folders in a container.

Auth: Uses DefaultAzureCredential, which will use your current `az login` session locally.
- Make sure you've run `az login` (or `az login --tenant <tenantId>`) first.

Install:
  pip install azure-identity azure-storage-blob

Examples:
  python tag_langcode.py --account-name mystorageacct --container xyw
  python tag_langcode.py --account-name mystorageacct --container xyw --dry-run
  python tag_langcode.py --account-name mystorageacct --container xyw --en-prefix data/en/ --fr-prefix data/fr/

Notes:
- This sets blob METADATA (name/value pairs), not blob index tags. Key used: langcode
- Metadata keys are case-insensitive and stored as lowercase in Azure Storage.
- Setting metadata replaces the metadata collection, so we fetch existing metadata and merge.
"""

import argparse
import sys
from typing import Dict, Tuple

from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import HttpResponseError, ResourceNotFoundError


def upsert_metadata_for_prefix(
    container_client,
    prefix: str,
    langcode: str,
    dry_run: bool = False,
) -> Tuple[int, int]:
    """
    For every blob whose name starts with `prefix`, set metadata['langcode'] = langcode.
    Returns (total_seen, total_updated).
    """
    total = 0
    updated = 0

    # list_blobs paginates automatically; iterate all
    for blob_item in container_client.list_blobs(name_starts_with=prefix):
        # Skip any "directory" placeholder blobs if present
        if blob_item.name.endswith("/"):
            continue

        total += 1
        blob_client = container_client.get_blob_client(blob_item.name)

        try:
            props = blob_client.get_blob_properties()
            metadata: Dict[str, str] = dict(props.metadata or {})

            current_value = metadata.get("langcode")
            needs_update = current_value != langcode

            if needs_update:
                metadata["langcode"] = langcode
                if dry_run:
                    print(f"[DRY-RUN] Would set metadata on '{blob_item.name}': langcode={langcode}")
                else:
                    blob_client.set_blob_metadata(metadata=metadata)
                    print(f"Set metadata on '{blob_item.name}': langcode={langcode}")
                updated += 1
            else:
                print(f"Skip (already set): '{blob_item.name}' langcode={current_value}")

        except ResourceNotFoundError:
            print(f"Warn: Blob not found while processing: {blob_item.name}", file=sys.stderr)
        except HttpResponseError as e:
            print(f"Error updating metadata for '{blob_item.name}': {e}", file=sys.stderr)

    return total, updated


def main():
    parser = argparse.ArgumentParser(description="Add langcode metadata to blobs under en/ and fr/ prefixes.")
    parser.add_argument("--account-name", required=True, help="Storage account name, e.g., mystorageacct")
    parser.add_argument("--container", required=True, help="Container name, e.g., xyw")
    parser.add_argument("--en-prefix", default="en/", help="Prefix path for English blobs (default: en/)")
    parser.add_argument("--fr-prefix", default="fr/", help="Prefix path for French blobs (default: fr/)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without writing metadata")
    parser.add_argument(
        "--account-url",
        help="Optional full account URL, e.g., https://mystorageacct.blob.core.windows.net "
             "(defaults to public cloud URL built from --account-name).",
    )
    args = parser.parse_args()

    account_url = args.account_url or f"https://{args.account_name}.blob.core.windows.net"

    print("Authenticating with DefaultAzureCredential (will use az CLI if available)...")
    credential = DefaultAzureCredential(exclude_interactive_browser_credential=False)

    try:
        service_client = BlobServiceClient(account_url=account_url, credential=credential)
        container_client = service_client.get_container_client(args.container)

        # Quick existence check
        container_client.get_container_properties()
    except HttpResponseError as e:
        print(f"Failed to access container '{args.container}' in account '{args.account_name}': {e}", file=sys.stderr)
        sys.exit(1)

    print(f"Target account: {account_url}")
    print(f"Target container: {args.container}")
    print(f"English prefix: {args.en_prefix} -> langcode='en'")
    print(f"French  prefix: {args.fr_prefix} -> langcode='fr'")
    if args.dry_run:
        print("Running in DRY-RUN mode. No changes will be written.")

    totals = {"en": (0, 0), "fr": (0, 0)}

    print("\nProcessing EN blobs...")
    totals["en"] = upsert_metadata_for_prefix(container_client, args.en_prefix, "en", args.dry_run)

    print("\nProcessing FR blobs...")
    totals["fr"] = upsert_metadata_for_prefix(container_client, args.fr_prefix, "fr", args.dry_run)

    print("\nSummary:")
    en_total, en_updated = totals["en"]
    fr_total, fr_updated = totals["fr"]
    print(f"EN: scanned={en_total}, updated={en_updated}")
    print(f"FR: scanned={fr_total}, updated={fr_updated}")

    if args.dry_run:
        print("\nRe-run without --dry-run to apply changes.")


if __name__ == "__main__":
    main()