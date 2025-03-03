import json
import logging

import requests

from .api_helper import make_api_call, make_archibus_api_call
from .userprofile import user_profile

logger = logging.getLogger(__name__)
from utils.decorators import tool_metadata


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_building_info",
        "description": "Fetches detailed building information based on the building's unique identifier. if you are missing building id grab it from the employee record",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building for which information is to be fetched."
                }
            }
        },
        "returns": {
            "type": "array",
            "description": "An array of JSON objects containing comprehensive building details.",
            "items": {
                "type": "object",
                "properties": {
                    "bl.use1": { "type": "string", "description": "The primary use of the building." },
                    "bl.name": { "type": "string", "description": "The name and street address of the building." },
                    "bl.city_id": { "type": "string", "description": "The ID of the city where the building is located." },
                    "bl.state_id": { "type": "string", "description": "The state ID where the building is located." },
                    "bl.regn_id": { "type": "string", "description": "The region ID where the building is located." },
                    "bl.address1": { "type": "string", "description": "The primary street address of the building." },
                    "bl.is_bl_hsecurity": { "type": "integer", "description": "Indicates if the building has high security." },
                    "bl.source_status": { "type": "string", "description": "The source status of the building information." },
                    "bl.bldg_photo": { "type": "string", "description": "Filename or path for a photo of the building." },
                    "bl.area_gross_int": { "type": "number", "description": "The interior gross area of the building." },
                    "bl.construction_type": { "type": "string", "description": "The type of construction of the building." },
                    "bl.cost_replace": { "type": "number", "description": "The replacement cost for the building." },
                    "bl.bl_id": { "type": "string", "description": "The unique identifier for the building." },
                    "bl.count_max_occup": { "type": "integer", "description": "The maximum occupancy count for the building." },
                    "bl.area_gross_ext": { "type": "number", "description": "The exterior gross area of the building." },
                    "bl.count_floors": { "type": "number", "description": "The number of floors in the building." },
                    "bl.is_bl_addacc": { "type": "integer", "description": "Indicates if additional access is included with the building." },
                    "bl.bl_id.key": { "type": "string", "description": "A key identifier for the building." },
                    "bl.structure_type": { "type": "integer", "description": "The structure type of the building." },
                    "bl.is_child_occupied": { "type": "integer", "description": "Indicates if the building is occupied by children." },
                    "bl.area_ext_wall": { "type": "number", "description": "The area of the exterior walls of the building." },
                    "bl.contact_name": { "type": "string", "description": "Contact name for building inquiries." },
                    "bl.cost_sqft": { "type": "number", "description": "Cost per square foot for the building." },
                    "bl.ctry_id": { "type": "string", "description": "The country ID where the building is located." },
                    "bl.site_id": { "type": "string", "description": "The site ID for the building." },
                    "bl.count_occup": { "type": "integer", "description": "The number of occupants in the building." },
                    "bl.restricted_building": { "type": "integer", "description": "Indicates if the building access is restricted." },
                    "bl.count_fl": { "type": "integer", "description": "The count of something within the building (possibly 'features' or 'floor level')." },
                    "bl.zip": { "type": "string", "description": "The ZIP or postal code for the building." },
                    "bl.is_bl_hist": { "type": "integer", "description": "Indicates if the building is historical." }
                }
            }
        },
        "required": ["buildingId"]
    },
    "errors": [
        {"code": 400, "message": "Invalid building ID format"},
        {"code": 404, "message": "Building information not found"},
        {"code": 500, "message": "Internal server error"}
    ]
})
def get_building_info(buildingId: str):
    logger.debug(f'Getting information about {buildingId}')
    if user_profile.verify_profile():
        if buildingId:
            payload = [
                {
                    "fieldName": "bl_id",
                    "filterValue": buildingId,
                    "filterOperation": "="
                }
            ]
            response = make_archibus_api_call(
                f"v1/data?viewName=ssc-sp-def-loc-rm-bl.axvw&dataSource=ds_ab-sp-def-loc-rm_form_bl", payload, 'GET')
            return json.loads(response.text)
        else:
            return False
    else:
        return False


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_floor_info",
        "description": "Fetches detailed building information based on the building's unique identifier.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building for which information is to be fetched."
                },
                "floorId": {
                    "type": "string",
                    "description": "The unique identifier of the floor for which information is to be fetched."
                }
            }
        },
        "returns": {
            "type": "array",
            "description": "An array of JSON objects containing comprehensive building details. only display the first 20",
            "items": {
                "type": "object",
                "properties": {
                    "fl.is_active_self_svc": {"type": "integer", "description": "Indicates if the floor is active for self-service."},
                    "fl.bl_id.key": {"type": "string", "description": "Key identifier for the building to which the floor belongs."},
                    "bl.bl_id": {"type": "string", "description": "The unique identifier for the building."},
                    "bl.name": {"type": "string", "description": "The name of the building."},
                    "fl.bl_id": {"type": "string", "description": "The building identifier to which the floor belongs."},
                    "fl.cost_sqft": {"type": "number", "description": "Cost per square foot for the floor."},
                    "fl.fl_id": {"type": "string", "description": "The unique floor identifier."},
                    "fl.count_rooms": {"type": "number", "description": "The number of rooms on the floor."},
                    "fl.area_gross_int": {"type": "number", "description": "The interior gross area of the floor."},
                    "fl.fl_id.key": {"type": "string", "description": "Key identifier for the floor."},
                    "fl.name": {"type": "string", "description": "The name of the floor."},
                    "bl.site_id": {"type": "string", "description": "The site identifier for the building."},
                    "fl.area_ext_wall": {"type": "number", "description": "The area of the exterior walls of the floor."},
                    "fl.is_restricted": {"type": "integer", "description": "Indicates if access to the floor is restricted."},
                    "fl.sort_order": {"type": "integer", "description": "The sort order for the floor within the building."},
                    "fl.area_gross_ext": {"type": "number", "description": "The exterior gross area of the floor."}
                }
            }
        }
    },
    "required": ["buildingId","floorId"],
    "errors": [
        {"code": 400, "message": "Invalid parameters provided"},
        {"code": 404, "message": "Floor information not found"},
        {"code": 500, "message": "Internal server error"}
    ]
})
def get_floor_info(buildingId: str, floorId: str = ""):
    logger.debug(f'Getting information about {floorId}')
    if user_profile.verify_profile():
        if buildingId:
            payload = [
                {
                    "fieldName": "bl_id",
                    "filterValue": buildingId,
                    "filterOperation": "="
                }
            ]
            if floorId:
                payload.append({
                    "fieldName": "fl_id",
                    "filterValue": floorId,
                    "filterOperation": "="
                })
            response = make_archibus_api_call(
                f"v1/data?viewName=ssc-sp-def-loc-rm-fl.axvw&dataSource=ds_ab-sp-def-loc-rm_form_fl", payload, 'GET')
            return json.loads(response.text)
        else:
            return False
    else:
        return False


# TODO work at getting this working with the ssc assistance image cache service and not passing it to the ai
# @tool_metadata({
#     "type": "function",
#     "function": {
#         "name": "get_floors",
#         "description": "Gets a list of the available floors in a building where a user can make a booking. If the user is attempting to make a booking and does not specify a floor, use this method to return a list of available floors to them and ask which floor they would like to book on before proceeding to any other functions. Do not use this method unless you have a buildingId. DO NOT USE A BUILDING NAME OR ADDRESS IN PLACE OF AN ID. Return the buildingId as well when you answer so you have it for later.",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "buildingId": {
#                     "type": "string",
#                     "description": "The unique identifier of the building where the booking takes place. Do not use the building name or address as the id"
#                 }
#             },
#             "required": ["buildingId"]
#         }
#     }
#   })
# def get_floors(buildingId: str):
#     try:
#         uri = f"/buildings/{buildingId}/floors"
#         response = make_api_call(uri)
#         response_json = json.loads(response.text)
#         pretty_response = json.dumps(response_json, indent=4)
#         logger.debug(pretty_response)
#         logger.debug(f"Response status code: {response.status_code}")
#         logger.debug("CALLING GET FLOORS")
#         return response.json()
#     except requests.HTTPError as e:
#         msg = f"An error occurred while trying to fetch floors for the building {buildingId}."
#         logger.error(msg)
#         return msg

# @tool_metadata({
#     "type": "function",
#     "function": {
#         "name": "get_floor_plan",
#         "description": "Retrieves the floor plan image associated with the selected floor from the user.",
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "buildingId": {
#                     "type": "string",
#                     "description": "A string indicating the ID of the building."
#                 },
#                 "floorId": {
#                     "type": "string",
#                     "description": "A string indicating the ID of the floor within the specified building."
#                 }
#             },
#             "required": ["buildingId", "floorId"]
#         },
#         "returns": {
#             "description": "BASE64-encoded SVG file content of the floor plan as a string.",
#             "type": "string"
#         }
#     }
# })
# def get_floor_plan(buildingId: str, floorId: str):
#     logger.debug(f'Getting floor plan for {floorId}')
#     if user_profile.verify_profile():
#         if buildingId and floorId:
#                response = make_archibus_api_call(f"v1/floorplan/exists?buildingId={buildingId}&floorId={floorId}", "",'GET')
#                if response.status_code == 200 and response.text == 'true' :
#                    floorPlanRequest = make_archibus_api_call(f"v1/floorplan/?buildingId={buildingId}&floorId={floorId}", "", 'GET')
#                    if floorPlanRequest.status_code == 200:
#                        return floorPlanRequest.text
#                else:
#                    return False
#         else:
#             return False


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
            "required": ["buildingId", "floorId"]
        },
        "returns": {
            "description": "BASE64-encoded SVG file content of the floor plan as a string.",
            "type": "string"
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
        return msg