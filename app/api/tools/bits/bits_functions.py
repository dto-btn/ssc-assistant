import pyodbc
import pandas as pd
import json
from utils.decorators import tool_metadata

# Define the connection string
server = 'your_server_name'
database = 'your_database_name'
username = 'your_username'
password = 'your_password'
driver = '{ODBC Driver 17 for SQL Server}'  # Make sure you have the correct ODBC driver installed

connection_string = f'DRIVER={driver};SERVER={server};DATABASE={database};UID={username};PWD={password}'

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_information",
        "description": "Gets information about a BR given a specific BR number.",
        "parameters": {
            "type": "object",
            "properties": {
                "br_number": {
                    "type": "string",
                    "description": "A BR number."
                }
            },
            "required": ["br_number"]
      }
    }
  })
def get_br_information(br_number: str = ""):
  """gets br information"""
  conn = pyodbc.connect(connection_string)

  # Create a cursor object
  cursor = conn.cursor()
  # Define your query
  query = '''
  SELECT TOP (1000) [BR_NMBR]
        ,[PERIOD_END_DATE]
        ,[BR_COUNT]
        ,[DAYS_SINCE_SUBMIT]
        ,[STATUS_ID]
        ,[LAST_STATUS_DATE]
        ,[DAYS_IN_STATUS]
        ,[AGE_IN_STATUS_EN]
        ,[AGE_IN_STATUS_FR]
        ,[REV_FLAG]
        ,[PREV_FY_ONE_TIME_AMT]
        ,[PREV_FY_SUPP_AMT]
        ,[PREV_FY_ONGOING_AMT]
        ,[PREV_FY_TOTAL_REV_AMT]
        ,[PREV_FY_ESM_SRVC_AMT]
        ,[CURR_FY_ONE_TIME_AMT]
        ,[CURR_FY_SUPP_AMT]
        ,[CURR_FY_ONGOING_AMT]
        ,[CURR_FY_TOTAL_REV_AMT]
        ,[CURR_FY_ESM_SRVC_AMT]
        ,[FY_2_ONE_TIME_AMT]
        ,[FY_2_SUPP_AMT]
        ,[FY_2_ONGOING_AMT]
        ,[FY_2_TOTAL_REV_AMT]
        ,[FY_2_ESM_SRVC_AMT]
        ,[FY_3_ONE_TIME_AMT]
        ,[FY_3_SUPP_AMT]
        ,[FY_3_ONGOING_AMT]
        ,[FY_3_TOTAL_REV_AMT]
        ,[FY_3_ESM_SRVC_AMT]
        ,[FY_4_ONE_TIME_AMT]
        ,[FY_4_SUPP_AMT]
        ,[FY_4_ONGOING_AMT]
        ,[FY_4_TOTAL_REV_AMT]
        ,[FY_4_ESM_SRVC_AMT]
        ,[FY_5_ONE_TIME_AMT]
        ,[FY_5_SUPP_AMT]
        ,[FY_5_ONGOING_AMT]
        ,[FY_5_TOTAL_REV_AMT]
        ,[FY_5_ESM_SRVC_AMT]
        ,[ALL_ONE_TIME_REV_AMT]
        ,[ALL_SUPP_REV_AMT]
        ,[ALL_ONGOING_REV_AMT]
        ,[ALL_REV_AMT]
        ,[ALL_ESM_SRVC_AMT]
        ,[YTD_INV_AMT]
        ,[PARENT_SRVC_OUTLIER_FLAG]
        ,[SRVC_OUTLIER_FLAG]
        ,[CUST_OUTLIER_FLAG]
        ,[CYCLE_TIMES_FLAG]
        ,[DAYS_IN_PHASE_ASSMT]
        ,[DAYS_IN_PHASE_DESIGN]
        ,[DAYS_IN_PHASE_AGRMT_SSC]
        ,[DAYS_IN_PHASE_AGRMT_CUST]
        ,[DAYS_IN_PHASE_IMPL]
        ,[DAYS_IN_PHASE_IN_SRVC]
        ,[DAYS_IN_PHASE_OTHER]
        ,[IMPL_FLAG_EN]
        ,[IMPL_FLAG_FR]
        ,[REASON_FOR_COLR_EN]
        ,[REASON_FOR_COLR_FR]
        ,[EXTRACTION_DATE]
    FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]'''
  # Execute the query
  cursor.execute(query)
  # Fetch all rows from the executed query
  rows = cursor.fetchall()
  # Get column names from the cursor description
  columns = [column[0] for column in cursor.description]
  # Convert the rows to a list of dictionaries
  results = [dict(zip(columns, row)) for row in rows]
  # Convert the list of dictionaries to JSON format
  json_result = json.dumps(results, indent=4)
  # Close the cursor and connection
  cursor.close()
  conn.close()
  # Print the JSON result
  return json_result