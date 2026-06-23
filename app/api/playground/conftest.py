"""
Pytest configuration for the playground test suite.

Sets minimal environment variables before any module is imported so that
import-time initialisation in ``utils/azure_clients.py`` and
``utils/auth.py`` doesn't attempt real network calls or fail due to missing
configuration.
"""
import os

# Must be set before azure_clients.py is imported (module-level BlobServiceClient init).
os.environ.setdefault("BLOB_ENDPOINT", "https://dummy.blob.core.windows.net/")

# Must be set before auth.py is imported so OAuth2TokenValidation is not constructed.
os.environ.setdefault("SKIP_USER_VALIDATION", "true")
