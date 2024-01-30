from dotenv import load_dotenv
from flask import Flask, jsonify, request
from api.v1 import routes as api_v1

load_dotenv()

app = Flask(__name__)

app.register_blueprint(api_v1, url_prefix='api/1.0')


        # Use search client to demonstration using existing index
        # search_client = SearchClient(
        #     endpoint=service_endpoint,
        #     index_name=name,
        #     credential=credential,
        # )