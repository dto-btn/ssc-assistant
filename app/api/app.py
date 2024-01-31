from dotenv import load_dotenv
from flask import Flask
from v1.routes_v1 import api_v1

load_dotenv()

app = Flask(__name__)

app.register_blueprint(api_v1, url_prefix='/api/1.0')