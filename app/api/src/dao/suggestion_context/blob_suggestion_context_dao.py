import json
import logging
import uuid
from datetime import datetime
from typing import override

from azure.storage.blob import BlobServiceClient, ContainerClient
from azure.core.exceptions import ResourceNotFoundError

from src.dao.suggestion_context.suggestion_context_dao_types import (
    BaseSuggestionContextDao,
)
from src.service.suggestion_service_types import (
    SuggestionCitation,
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)

logger = logging.getLogger(__name__)

CONTAINER_NAME = "suggestion-contexts"


class BlobSuggestionContextDao(BaseSuggestionContextDao):
    """
    Azure Blob Storage implementation of the SuggestionContextDao.
    Each suggestion context is stored as a JSON blob named {id}.json
    in the 'suggestion-contexts' container.
    """

    def __init__(self, blob_service_client: BlobServiceClient):
        self.blob_service_client = blob_service_client
        self.container_client: ContainerClient = (
            blob_service_client.get_container_client(CONTAINER_NAME)
        )
        # Ensure the container exists
        try:
            self.container_client.get_container_properties()
        except ResourceNotFoundError:
            self.container_client.create_container()

    @override
    def get_suggestion_context_by_id(
        self, suggestion_id: str
    ) -> SuggestionContextWithSuggestionsAndId | None:
        try:
            # Validate that the ID is a proper UUID to prevent arbitrary blob access
            uuid_obj = uuid.UUID(suggestion_id)
        except (ValueError, AttributeError):
            return None

        blob_name = f"{uuid_obj}.json"
        blob_client = self.container_client.get_blob_client(blob_name)
        try:
            data = blob_client.download_blob().readall()
        except ResourceNotFoundError:
            return None

        record = json.loads(data)
        return self._from_blob(record)

    @override
    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestions
    ) -> SuggestionContextWithSuggestionsAndId:
        suggestion_id = str(uuid.uuid4())

        record = {
            "id": suggestion_id,
            "success": suggestion["success"],
            "language": suggestion["language"],
            "original_query": suggestion["original_query"],
            "timestamp": suggestion["timestamp"],
            "requester": suggestion["requester"],
            "content": suggestion["content"],
            "citations": [
                {"title": c["title"], "url": c["url"]}
                for c in suggestion["citations"]
            ],
        }

        blob_name = f"{suggestion_id}.json"
        blob_client = self.container_client.get_blob_client(blob_name)
        blob_client.upload_blob(
            json.dumps(record),
            overwrite=True,
            metadata={"created_at": suggestion["timestamp"]},
        )

        return self._from_blob(record)

    @override
    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        for blob in self.container_client.list_blobs(include=["metadata"]):
            created_at_str = (blob.metadata or {}).get("created_at")
            if not created_at_str:
                continue
            try:
                # Timestamps are stored as ISO-like strings ending in Z
                created_at = datetime.fromisoformat(
                    created_at_str.replace("Z", "+00:00")
                )
                # Compare as naive datetimes to match existing behaviour
                created_at_naive = created_at.replace(tzinfo=None)
                if created_at_naive <= delete_before_inclusive:
                    self.container_client.delete_blob(blob.name)
            except (ValueError, TypeError):
                logger.warning(
                    "Could not parse created_at for blob %s: %s",
                    blob.name,
                    created_at_str,
                )

    @staticmethod
    def _from_blob(
        record: dict,
    ) -> SuggestionContextWithSuggestionsAndId:
        return SuggestionContextWithSuggestionsAndId(
            id=record["id"],
            success=True,
            language=record["language"],
            original_query=record["original_query"],
            timestamp=record["timestamp"],
            requester=record["requester"],
            content=record["content"],
            citations=[
                SuggestionCitation(title=c["title"], url=c["url"])
                for c in record["citations"]
            ],
        )
