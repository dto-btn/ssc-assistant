import requests
import logging
import json
from .archibus_functions import make_archibus_api_call

logger = logging.getLogger(__name__)

def get_user_profile_by_id():
    user_id = get_user_id()
    user_url = f"v1/user/{user_id}"

    response =  make_archibus_api_call(user_url)
    if response.status_code == 200:
        return response.json()
    else:
        logger.error(f"Failed to get user with ID {user_id}: {response.text}")
        response.raise_for_status()

def get_user_id():
    # Proper way to get the user id would probably involve different logic.
    return "CODY.ROBILLARD@SSC-SPC.GC.CA" # Placeholder
