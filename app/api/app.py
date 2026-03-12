import logging
import os
import importlib.util

from apiflask import APIFlask
from dotenv import load_dotenv
from v1.routes_v1 import api_v1
from playground.routes_playground import api_playground
from proxy import (
    ROOT_PATH_PROXY_AZURE,
    ROOT_PATH_PROXY_LITELLM,
    proxy_azure,
    proxy_litellm,
)
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logging.getLogger("v1").setLevel(logging.DEBUG)
logging.getLogger("azure.core.pipeline.policies").setLevel(logging.ERROR)


def _log_litellm_startup_status() -> None:
    """Emit an explicit startup readiness message for embedded LiteLLM gateway."""
    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()
    json_logs = os.getenv("LITELLM_JSON_LOGS", "true").strip().lower() in {"1", "true", "yes", "on"}
    litellm_installed = importlib.util.find_spec("litellm") is not None

    if litellm_installed and default_model:
        logging.getLogger(__name__).info(
            "LiteLLM gateway ready mode=embedded model=%s json_logs=%s route=/proxy/litellm/v1/responses",
            default_model,
            json_logs,
        )
        return

    missing: list[str] = []
    if not litellm_installed:
        missing.append("litellm package")
    if not default_model:
        missing.append("LITELLM_DEFAULT_MODEL")

    logging.getLogger(__name__).warning(
        "LiteLLM gateway not ready mode=embedded missing=%s route=/proxy/litellm/v1/responses",
        ", ".join(missing),
    )

load_dotenv()
_log_litellm_startup_status()

app = APIFlask(__name__, title="SSC Assistant API", version="2.0")
CORS(app)

app.servers = [
    {
        'name': 'Prod (Sandbox)',
        'url': os.getenv('SERVER_URL', 'https://ssc-assistant-api.azurewebsites.net')
    },
    {
        'name': 'DEV',
        'url': 'https://ssc-assistant-dev-api.azurewebsites.net'
    },
    {
        'name': 'Localhost',
        'url': 'http://127.0.0.1:5001'
    }
]

# https://apiflask.com/configuration/#security_schemes
# doesn't seem to be a way to add multiple ones that are concurrently used.
app.security_schemes = {  # equals to use config SECURITY_SCHEMES
    'ApiKeyAuth': {
      'type': 'apiKey',
      'in': 'header',
      'name': 'X-API-Key',
    }
}

app.register_blueprint(api_v1, url_prefix='/api/1.0')
app.register_blueprint(api_playground, url_prefix='/api/playground')
app.register_blueprint(proxy_azure, url_prefix=ROOT_PATH_PROXY_AZURE)
app.register_blueprint(proxy_litellm, url_prefix=ROOT_PATH_PROXY_LITELLM)
