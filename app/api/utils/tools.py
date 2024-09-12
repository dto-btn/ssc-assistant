import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Union
from azure.storage.blob import BlobServiceClient
import requests
from openai import AzureOpenAI
from openai.types.chat import (ChatCompletionMessageParam)
from datetime import datetime

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_limit = 100

# Get the directory of the current file (tools.py)
_current_dir = Path(__file__).parent
# Construct the path to 'tools.json' within the same directory
_tools_path = _current_dir / 'tools.json'
# Open the file using the absolute path
with _tools_path.open('r') as f:
    _all_tools = json.load(f)

def load_tools(toolsUsed: List[str]):
    tools = [tool for tool in _all_tools if 'tool_type' in tool and tool['tool_type'] in toolsUsed]
    return tools

def load_records():
    '''
    Temporary method to loads GEDS data for demo purposes..
    '''
    try:
        # Get the directory of the current file (tools.py)
        current_dir = Path(__file__).parent
        # Construct the path to 'data/data.json' within the data directory
        data_json_path = current_dir / '../data/data.json'
        data_json_path = data_json_path.resolve()
        # Open the file using the absolute path
        with data_json_path.open('r') as file:
            data = json.load(file)
            records = data['results'][0]['items']
    except:
        logger.error("Unable to load data.json (BITS sample data), will return an empty array instead")
        records = []
    return records

records = load_records()

def pretty_print_br(json_br):
    return f"{json_br['br_number']} ({json_br['long_title']}) Required Implementation date: {json_br['req_implement_date']}, Forecasted Impl Date: {json_br['implement_target_date']}, Status: {json_br['status_name']}, Client name: {json_br['client_name']}"

def get_records_req_impl_by_year(year):
    """
    Required implementation date for BR
    """
    print("calling function to get records req implementation date.")
    # Extract the last two digits of the year
    year_suffix = '-' + year[2:]

    # Filter records that have a 'req_implement_date' ending with the specified year_suffix
    filtered_records = [record for record in records if record.get('req_implement_date', '').endswith(year_suffix)]

    # Return the filtered records as a JSON response
    return [pretty_print_br(br) for br in filtered_records[:_limit]]

def get_forecasted_br_for_month(month, year: str="2024"):
    """
    get the forcasted BRs information for a given month (and year)
    """
    print("calling BR forecast for month")
    # Extract the last two digits of the year
    year_suffix = '-' + year[2:]
    month_suffix = '-' + str.upper(month[:3])
    pattern = r"\b\d{2}"+ month_suffix + year_suffix + r"\b"
    filtered_records = [record for record in records if re.match(pattern, record['implement_target_date'])]

    # Return the filtered records as a JSON response
    return [pretty_print_br(br) for br in filtered_records[:_limit]]

def get_br_count_with_target_impl_date(valid: bool=True):
    """
    returns the BR counts of all the BRs with either a valid/invalid TID (target impl date)
    """
    print(f"checking VALID BRs ({valid}). Current total records to filter is {len(records)}")
    # Define the regex pattern
    pattern = r"\b\d{2}-[A-Z]{3}-\d{2}\b"
    valid_records = 0
    not_valid_records = 0
    for record in records:
        if record['implement_target_date']:
            if re.match(pattern, record['implement_target_date']):
                valid_records += 1
            else:
                not_valid_records += 1
        else:
            not_valid_records += 1

    return valid_records if valid else not_valid_records

def get_br_information(br_number: int):
    """
    get information about a specific BR number
    """
    print(f"getting info for BR -> {br_number}")
    for record in records:
        if record['br_number'] == br_number:
            return pretty_print_br(record)
    # didn't find the record.
    return "Didn't find any matching Business Request (BR) matching that number."

def get_employee_information(employee_lastname: str = "", employee_firstname: str = ""):
    """
    get information about a specific employee
    """
    print(f"getting info for employee -> {employee_firstname} {employee_lastname}")
    # Check if the last name is provided, otherwise request it
    if not employee_lastname:
        return "Please provide a last name to search for an employee."

    # Check if the first name is provided
    if employee_firstname:
        search_value = f"{employee_lastname}%2C{employee_firstname}"
    else:
        search_value = employee_lastname

    url = (
        "https://api.geds-sage.gc.ca/gapi/v2/employees?"
        f"searchValue={search_value}&searchField=9&searchCriterion=2&searchScope=sub&searchFilter=2&maxEntries=5&pageNumber=1&returnOrganizationInformation=yes"
    )

    payload = {}
    api_token = os.getenv("GEDS_API_TOKEN")
    headers = {
        'X-3scale-proxy-secret-token': api_token,
        'Accept': 'application/json'
    }

    response = requests.request("GET", url, headers=headers, data=payload)

    # Check if the response was successful
    if response.status_code == 200:
        # Check if the response contains multiple employees with the same last name
        if len(json.loads(response.text)) > 1 and not employee_firstname:
            return "Found multiple employees with that last name. Please provide the first name as well. However, here are some of the first results: " + response.text
        
        # Check if the response contains multiple employees with the same first and last name
        elif len(json.loads(response.text)) > 1:
            return "Found multiple employees with that name. Return the phone number, name, and address for each employee, if available. Here are the results: " + response.text

        else:
            return "Found an employee with that name. Return the phone number, name, and address for the employee, if available" + response.text
    else:
        return "Didn't find any matching employee with that name."

def get_employee_by_phone_number(employee_phone_number: str):
    """
    get information about a specific employee by phone number
    """
    print(f"getting info for employee with phone number-> {employee_phone_number}")
    # if phone number doesnt contain "-", add it
    if "-" not in employee_phone_number:
        employee_phone_number = employee_phone_number[:3] + "-" + employee_phone_number[3:6] + "-" + employee_phone_number[6:]

    url = (
        "https://api.geds-sage.gc.ca/gapi/v2/employees?"
        f"searchValue={employee_phone_number}&searchField=9&searchCriterion=2&searchScope=sub&searchFilter=2&maxEntries=5&pageNumber=1&returnOrganizationInformation=yes"
    )

    payload = {}
    api_token = os.getenv("GEDS_API_TOKEN")
    headers = {
        'X-3scale-proxy-secret-token': api_token,
        'Accept': 'application/json'
    }

    response = requests.request("GET", url, headers=headers, data=payload)

    # Check if the response was successful
    if response.status_code == 200:
        logger.debug(response)
        return json.dumps(response.text)
    else:
        logger.debug("Unable to get any info.", response)
        return "Didn't find any matching employee with that phone number."
    

def get_buildings(buildingName: str = ""):
    """
    get information about buildings available to book a workspace through Archibus, such as the
    building's address, buildingId, name, and postal code
    """
    url = "http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/buildings/"

    if not buildingName:
        return "Please provide a building name or address to search for"

    username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    # Include username and password in the request headers
    auth = (username, password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)

        if response.status_code == 200:
            response_json = json.loads(response.text)

            substrings = buildingName.lower().split()

            excluded_substrings = ['road', 'rd', 'street', 'ave', 'avenue']
            filtered_substrings = [substring for substring in substrings if substring not in excluded_substrings]

            logger.debug(f"SUBSTRINGS: {filtered_substrings}")
            filtered_buildings = [building for building in response_json if building.get('name') and any(substring in building['name'].lower() for substring in filtered_substrings)]
            pretty_response = json.dumps(filtered_buildings, indent=4)
            logger.debug(pretty_response)
            return pretty_response

        else:
            logger.error(f"Unable to get any buildings info. Status code: {response.status_code}")
            return "Didn't find any buildings."

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request: {e}")
        return "An error occurred while trying to fetch buildings."
    

def verify_booking_details(date: str, buildingId: str, user: str, bookingType: str, floorId: str, roomId: str):

    booking_details = {
        "createdBy": user,
        "assignedTo": user,
        "buildingId": buildingId,
        "floorId": floorId,
        "roomId": roomId,
        "bookingType": bookingType,
        "startDate": date
    }

    return booking_details
    

def get_user_bookings(firstName: str = "", lastName: str = ""):
    logger.debug("IN GET USER BOOKINGS")
    if not firstName or not lastName:
        return "please provide a first and last name to search for a user's reservations"

    url = f"http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/reservations/creator/{lastName.upper()},%20{firstName.upper()}"

    logger.debug(f"get reservations URL: {url}")
    api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    # Include username and password in the request headers
    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)

        if response.status_code == 200:
            filtered_response_json = json.loads(response.text)[-10:] # take last 10 items (API might be returning duplicates?)
            pretty_response = json.dumps(filtered_response_json, indent=4)
            logger.debug(f"Reservations: {pretty_response}")
            logger.debug(f"Response status code: {response.status_code}")
            return filtered_response_json  
        else:
            logger.error(f"Unable to get any buildings info. Status code: {response.status_code}")
            return "Didn't find any buildings."

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request: {e}")
        return "An error occurred while trying to fetch buildings."
    

def get_floors(buildingId: str):
    url = f"http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/buildings/{buildingId}/floors"

    api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)

        if response.status_code == 200:
            response_json = json.loads(response.text)
            pretty_response = json.dumps(response_json, indent=4)
            logger.debug(pretty_response)
            logger.debug(f"Response status code: {response.status_code}")
            return response.json()  
        else:
            logger.error(f"Unable to get any available floors info for the given building. Status code: {response.status_code}")
            return "Didn't find any floors for the given building."

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request to retrieve floors: {e}")
        return f"An error occurred while trying to fetch floors for the building {buildingId}."
    

def get_available_rooms(buildingId: str, floorId: str, bookingDate: str):
    floor_plan_file_name = get_floor_plan(buildingId=buildingId, floorId=floorId)
    logger.debug(f"FILE NAME: {floor_plan_file_name}")
   
    url = f"http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/reservations/buildings/{buildingId}/vacant/{floorId}?bookingDate={bookingDate}"

    api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)

        if response.status_code == 200:
            response_json = json.loads(response.text)
            filtered_rooms = response_json[:10]
            pretty_response = json.dumps(filtered_rooms, indent=4)
            logger.debug(pretty_response)
            logger.debug(f"Response status code: {response.status_code}")
            
            result = {
                "rooms": filtered_rooms
            }
            
            if floor_plan_file_name is not None:
                # base64_svg = base64.b64encode(floor_plan_blob).decode('utf-8')
                result["floorPlan"] = floor_plan_file_name

            return result
        else:
            logger.error(f"Unable to get any available rooms info for the given floor and building. Status code: {response.status_code}")
            return f"Didn't find any rooms for the given floor {floorId} and building {buildingId}."

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request to retrieve available rooms: {e}")
        return f"An error occurred while trying to fetch rooms for the given floor {floorId} and building {buildingId}."
    
def get_floor_plan_OLD(buildingId: str, floorId: str):
    url = f"http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/buildings/{buildingId}/floors/"

    api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)

        if response.status_code == 200:
            response_json = json.loads(response.text)
            target_floor_blob_name = None

            for floor in response_json:
                if floor.get('flId') == floorId:
                    target_floor_blob_name = floor.get('floorPlanFilename', '1430b-05-afm.svg').lower()
                    break  
            
            if target_floor_blob_name:
                return target_floor_blob_name
            else:
                logger.error(f"Floor plan URL not found for floorId: {floorId}")
                return None

        else:
            logger.error(f"Unable to get any available floors info for the given building. Status code: {response.status_code}")
            return None

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request to retrieve floors: {e}")
        return None

def get_floor_plan(buildingId: str, floorId: str):
    url = f"http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1/buildings/{buildingId}/floors"

    api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
    api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    try:
        response = requests.get(url, headers=headers, auth=auth)
        logger.debug(url)
        if response.status_code == 200:
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

        else:
            logger.error(f"Unable to get any available floors info for the given building. Status code: {response.status_code}")
            return None

    except requests.RequestException as e:
        logger.error(f"Error occurred during the GET request to retrieve floors: {e}")
        return None
    
def get_current_date() -> str:
    current_date_time = datetime.now()
    return "Formatted date and time:" + current_date_time.strftime("%Y-%m-%d %H:%M:%S")

def call_tools(tool_calls, messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]:
    """
    Call the tool functions and return a new completion with the results
    """
    # Define the available functions
    available_functions = {
        "get_employee_information": get_employee_information,
        "get_employee_by_phone_number": get_employee_by_phone_number,
        "get_buildings": get_buildings,
        "verify_booking_details": verify_booking_details,
        "get_user_bookings": get_user_bookings,
        "get_floors": get_floors,
        "get_available_rooms": get_available_rooms,
        "get_current_date": get_current_date,
    }

    # Send the info for each function call and function response to the model
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        if function_name in available_functions:
            function_to_call = available_functions[function_name]
            function = tool_call.function

            # function_args = function.arguments
            function_args = json.loads(function.arguments) if function.arguments else {}

            if function_args:
                prepared_args = {arg: function_args[arg] for arg in function_args}
                function_response = function_to_call(**prepared_args)
            else:
                function_response = function_to_call()
            
            messages.append({
                "role": "assistant",
                "content": None,
                "function_call": {
                    "name": function_name,
                    "arguments": json.dumps(function_args)
                }
            })

            # Convert the function response to a JSON string if it's a list or dict
            if isinstance(function_response, (list, dict)):
                response_as_string = json.dumps(function_response)
            else:
                response_as_string = str(function_response)

            # Add the function response to the messages
            messages.append({
                "role": "function",
                "name": function_name,
                "content": response_as_string
            })
            # reworking with this example to refine a bit:
            # https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling?tabs=python#working-with-function-calling
    return messages