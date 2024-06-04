import logging
import azure.functions as func
from azure.functions import TimerRequest
import azure.durable_functions as df
from fetch_index_data_bp import fetch_data_bp
from build_seach_index_bp import build_index_bp


app = df.DFApp(http_auth_level=func.AuthLevel.FUNCTION)
app.register_functions(fetch_data_bp)
app.register_functions(build_index_bp)

# Durable function that fetches all sscplus page IDs/pages and uploads them
@app.route(route="orchestrators/{functionName}")
@app.durable_client_input(client_name="client")
async def http_start(req: func.HttpRequest, client):
    function_name = req.route_params.get('functionName')
    instance_id = await client.start_new(function_name)
    response = client.create_check_status_response(req, instance_id)
    return response

# timer triggered:
@app.schedule(schedule="0 0 * * Sat", arg_name="myTimer", run_on_startup=False, use_monitor=False)
@app.durable_client_input(client_name="client")
async def fetch_index_timer_trigger(myTimer: func.TimerRequest, client) -> None:
    if myTimer.past_due:
        logging.info("The timer is past due")
    instance_id = await client.start_new("fetch_index_data")
    logging.info("fetch index timer trigger function executed")

# timer triggered:
@app.schedule(schedule="0 0 * * Sun", arg_name="myTimer", run_on_startup=False, use_monitor=False)
@app.durable_client_input(client_name="client")
async def build_index_timer_trigger(myTimer: func.TimerRequest, client) -> None:
    if myTimer.past_due:
        logging.info("The timer is past due")
    instance_id = await client.start_new("build_search_index")
    logging.info("build index timer trigger function executed")

