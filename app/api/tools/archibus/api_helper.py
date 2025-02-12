import requests
import logging
import os

api_url = str(os.getenv("ARCHIBUS_API_URL", "http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1"))
api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

from .archibus_api_v1 import AzureAuthToken

auth_token_instance = AzureAuthToken()
archibus_token = auth_token_instance.get_access_token()
archibus_url = auth_token_instance.get_archibus_url()

logger = logging.getLogger(__name__)

def make_api_call(uri: str, payload=None) -> requests.Response:
    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {archibus_token}'
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


def make_archibus_api_call(uri: str, payload=None, httptype=None) -> requests.Response:

    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {archibus_token}'
    }

    if payload:
        if httptype == "GET":
            response = requests.get(archibus_url + uri, headers=headers, json=payload)
        elif httptype == "PUT":
            response = requests.put(archibus_url + uri, headers=headers, data=payload)
        else:
            response = requests.post(archibus_url + uri, headers=headers, auth=archibus_token, data=payload)
    else:
        response = requests.get(archibus_url + uri, headers=headers)

    logger.debug(archibus_url + uri)
    response.raise_for_status()  # This will raise an HTTPError if the HTTP request returned an unsuccessful status code
    return response
