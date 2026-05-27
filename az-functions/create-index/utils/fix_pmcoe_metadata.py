import logging
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient, ContainerClient

logger = logging.getLogger(__name__)

EXPECTED_LANG_FOLDERS = {"en", "fr"}
METADATA_KEY = "langcode"


def fix_pmcoe_metadata(account_url: str, container_name: str, directory: str = "") -> dict:
    """Verify and fix blob metadata 'langcode' for all blobs under en/ and fr/ folders.

    Args:
        account_url: The Azure Storage account URL (e.g. https://<account>.blob.core.windows.net).
        container_name: The blob container name.
        directory: Optional base directory prefix within the container (e.g. "pmcoe").

    Returns:
        A summary dict with counts of verified, fixed, and skipped blobs.
    """
    credential = DefaultAzureCredential()
    blob_service_client = BlobServiceClient(account_url, credential=credential)
    container_client = blob_service_client.get_container_client(container_name)

    summary = {"verified": 0, "fixed": 0, "skipped": 0, "errors": 0}

    for lang in EXPECTED_LANG_FOLDERS:
        prefix = f"{directory}/{lang}/" if directory else f"{lang}/"
        logger.info("Scanning blobs under prefix: %s", prefix)

        for blob in container_client.list_blobs(name_starts_with=prefix, include=["metadata"]):
            blob_name = blob.name
            metadata = blob.metadata or {}

            current_langcode = metadata.get(METADATA_KEY)

            if current_langcode == lang:
                logger.debug("OK: %s already has langcode=%s", blob_name, lang)
                summary["verified"] += 1
                continue

            if current_langcode is not None:
                logger.warning(
                    "MISMATCH: %s has langcode=%s but expected %s — fixing",
                    blob_name, current_langcode, lang,
                )
            else:
                logger.info("MISSING: %s has no langcode metadata — setting to %s", blob_name, lang)

            try:
                metadata[METADATA_KEY] = lang
                blob_client = container_client.get_blob_client(blob_name)
                blob_client.set_blob_metadata(metadata)
                logger.info("FIXED: %s → langcode=%s", blob_name, lang)
                summary["fixed"] += 1
            except Exception:
                logger.exception("ERROR setting metadata on %s", blob_name)
                summary["errors"] += 1

    logger.info("Done. Summary: %s", summary)
    return summary


if __name__ == "__main__":
    import argparse

    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")

    parser = argparse.ArgumentParser(description="Verify/fix langcode metadata on Azure Blob Storage blobs.")
    parser.add_argument("--account-url", required=True, help="Azure Storage account URL")
    parser.add_argument("--container", required=True, help="Blob container name")
    parser.add_argument("--directory", default="", help="Base directory prefix within the container")
    parser.add_argument("--dry-run", action="store_true", help="Only report mismatches, do not fix")
    args = parser.parse_args()

    if args.dry_run:
        logging.getLogger(__name__).info("DRY RUN — no changes will be made")
        credential = DefaultAzureCredential()
        blob_service_client = BlobServiceClient(args.account_url, credential=credential)
        container_client = blob_service_client.get_container_client(args.container)

        for lang in EXPECTED_LANG_FOLDERS:
            prefix = f"{args.directory}/{lang}/" if args.directory else f"{lang}/"
            for blob in container_client.list_blobs(name_starts_with=prefix, include=["metadata"]):
                metadata = blob.metadata or {}
                current = metadata.get(METADATA_KEY)
                if current != lang:
                    print(f"  WOULD FIX: {blob.name} (current={current!r}, expected={lang!r})")
                else:
                    print(f"  OK: {blob.name}")
    else:
        result = fix_pmcoe_metadata(args.account_url, args.container, args.directory)
        print(f"Result: {result}")
