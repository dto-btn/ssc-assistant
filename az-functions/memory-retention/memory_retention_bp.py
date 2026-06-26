"""Memory retention cleanup — Azure Function timer trigger.

Runs weekly to delete memory nodes/edges older than the configured retention
window (default 90 days). This is required because Azure Table Storage has no
native TTL support.

Deploy alongside the existing az-functions/create-index function app, or as a
separate function app. Set these env vars:
  MEMORY_TABLE_ENDPOINT   – Azure Table Storage endpoint (DefaultAzureCredential)
  MEMORY_TABLE_CONNECTION_STRING – alternative for local/Azurite
  MEMORY_RETENTION_DAYS   – days to keep memories (default 90)
"""

import logging
import os
from datetime import UTC, datetime, timedelta

import azure.functions as func
from azure.data.tables import TableServiceClient
from azure.core.exceptions import ResourceNotFoundError
from azure.identity import DefaultAzureCredential

logger = logging.getLogger(__name__)

bp = func.Blueprint()

TABLE_NODES = "memorynodes"
TABLE_EDGES = "memoryedges"


def _get_service() -> TableServiceClient:
    endpoint = os.getenv("MEMORY_TABLE_ENDPOINT")
    if endpoint:
        return TableServiceClient(endpoint=endpoint, credential=DefaultAzureCredential())
    conn_str = os.getenv("MEMORY_TABLE_CONNECTION_STRING") or os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    if not conn_str:
        raise RuntimeError("Neither MEMORY_TABLE_ENDPOINT nor MEMORY_TABLE_CONNECTION_STRING is set")
    return TableServiceClient.from_connection_string(conn_str)


@bp.schedule(
    schedule="0 0 3 * * Sun",  # 03:00 UTC every Sunday
    arg_name="timer",
    run_on_startup=False,
    use_monitor=True,
)
def memory_retention_cleanup(timer: func.TimerRequest) -> None:
    retention_days = int(os.getenv("MEMORY_RETENTION_DAYS") or "90")
    cutoff = datetime.now(UTC) - timedelta(days=retention_days)
    cutoff_iso = cutoff.replace(microsecond=0).isoformat().replace("+00:00", "Z")

    logger.info("Memory retention cleanup started. Cutoff: %s (%d days)", cutoff_iso, retention_days)

    svc = _get_service()
    deleted_nodes = 0
    deleted_edges = 0

    # Delete stale nodes
    try:
        node_table = svc.get_table_client(TABLE_NODES)
        stale = list(node_table.query_entities(f"updated_at lt '{cutoff_iso}'"))
        for entity in stale:
            try:
                node_table.delete_entity(partition_key=entity["PartitionKey"], row_key=entity["RowKey"])
                deleted_nodes += 1
            except ResourceNotFoundError:
                pass
    except Exception as exc:
        logger.error("Failed to clean up nodes: %s", exc)

    # Delete stale edges
    try:
        edge_table = svc.get_table_client(TABLE_EDGES)
        stale_edges = list(edge_table.query_entities(f"created_at lt '{cutoff_iso}'"))
        for entity in stale_edges:
            try:
                edge_table.delete_entity(partition_key=entity["PartitionKey"], row_key=entity["RowKey"])
                deleted_edges += 1
            except ResourceNotFoundError:
                pass
    except Exception as exc:
        logger.error("Failed to clean up edges: %s", exc)

    logger.info(
        "Memory retention cleanup complete. Deleted nodes=%d edges=%d",
        deleted_nodes,
        deleted_edges,
    )
