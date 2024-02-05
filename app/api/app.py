from dotenv import load_dotenv
from apiflask import APIFlask
from v1.routes_v1 import api_v1
import logging

logging.basicConfig(level=logging.INFO)
logging.getLogger("v1").setLevel(logging.DEBUG)

load_dotenv()

app = APIFlask(__name__, title="SSC Assistant API", version="1.0")

app.register_blueprint(api_v1, url_prefix='/api/1.0')