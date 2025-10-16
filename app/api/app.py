import logging
import os

from apiflask import APIFlask
from dotenv import load_dotenv
from v1.routes_v1 import api_v1
from v1.routes_playground import api_playground
from proxy.azure import ROOT_PATH_PROXY_AZURE, proxy_azure
from flask_cors import CORS

logging.basicConfig(level=logging.INFO)
logging.getLogger("v1").setLevel(logging.DEBUG)
logging.getLogger("azure.core.pipeline.policies").setLevel(logging.ERROR)

load_dotenv()

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
