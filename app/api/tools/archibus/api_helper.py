import requests
import logging
import os

api_url = str(os.getenv("ARCHIBUS_API_URL", "http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1"))
api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

logger = logging.getLogger(__name__)

def make_api_call(uri: str, payload=None) -> requests.Response:
    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    if payload:
        headers['Accept'] = '*/*'
        headers['Content-Type'] = 'application/json'
        response = requests.post(api_url + uri, headers=headers, auth=auth, data=payload)
    else:
        response = requests.get(api_url + uri, headers=headers, auth=auth)

    logger.debug(api_url + uri)
    response.raise_for_status()  # This will raise an HTTPError if the HTTP request returned an unsuccessful status code
    return response
