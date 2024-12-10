import json
import logging

import requests

from .api_helper import make_api_call

logger = logging.getLogger(__name__)
from utils.decorators import tool_metadata


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_floors",
        "description": "Gets a list of the available floors in a building where a user can make a booking. If the user is attempting to make a booking and does not specify a floor, use this method to return a list of available floors to them and ask which floor they would like to book on before proceeding to any other functions. Do not use this method unless you have a buildingId. DO NOT USE A BUILDING NAME OR ADDRESS IN PLACE OF AN ID. Return the buildingId as well when you answer so you have it for later.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building where the booking takes place. Do not use the building name or address as the id"
                }
            },
            "required": ["buildingId"]
        }
    }
  })
def get_floors(buildingId: str):
    try:
        uri = f"/buildings/{buildingId}/floors"
        response = make_api_call(uri)
        response_json = json.loads(response.text)
        pretty_response = json.dumps(response_json, indent=4)
        logger.debug(pretty_response)
        logger.debug(f"Response status code: {response.status_code}")
        logger.debug("CALLING GET FLOORS")
        return response.json()
    except requests.HTTPError as e:
        msg = f"An error occurred while trying to fetch floors for the building {buildingId}."
        logger.error(msg)
        return msg

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_floor_plan",
        "description": "Retrieves the floor plan image associated with the selected floor from the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "A string indicating the ID of the building."
                },
                "floorId": {
                    "type": "string",
                    "description": "A string indicating the ID of the floor within the specified building."
                }
            },
            "required": ["floorId", "buildingId"]
        }
    }
})
def get_floor_plan(buildingId: str, floorId: str):
    try:
        uri = f"/buildings/{buildingId}/floors"
        response = make_api_call(uri)
        response_json = json.loads(response.text)
        target_floor_blob_name = None

        for floor in response_json:
            if floor.get('flId') == floorId:
                target_floor_blob_name = floor.get('floorPlanURL')
                break

        if target_floor_blob_name:
            return target_floor_blob_name
        else:
            logger.error(f"Floor plan URL not found for floorId: {floorId}")
            return None

    except requests.HTTPError as e:
        msg = f"Error occurred during the request to retrieve floors: {e}"
        logger.error(msg)
        return msg