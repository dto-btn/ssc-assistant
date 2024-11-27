import logging
import os

from apiflask import APIFlask
from dotenv import load_dotenv
from app.api.v1.routes_v1 import api_v1

logging.basicConfig(level=logging.INFO)
logging.getLogger("v1").setLevel(logging.DEBUG)
logging.getLogger("azure.core.pipeline.policies").setLevel(logging.ERROR)

load_dotenv()

app = APIFlask(__name__, title="SSC Assistant API", version="1.0")

app.servers = [
    {
        'name': 'Current Env.',
        'url': os.getenv('SERVER_URL', 'https://ssc-assistant-api.azurewebsites.net')
    }
]

app.security_schemes = {  # equals to use config SECURITY_SCHEMES
    'ApiKeyAuth': {
      'type': 'apiKey',
      'in': 'header',
      'name': 'X-API-Key',
    }
}

app.register_blueprint(api_v1, url_prefix='/api/1.0')
