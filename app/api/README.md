# Backend API for the ssc-assitant.

This api is exposed to the frontend and other teams (MySSC Plus).

## devs

To run the application simply do `cd app/api` then `flask --debug run --port=5001`

## generating new keys

[Documentation on how to generate a new key](https://pyjwt.readthedocs.io/en/stable/)

```python
import jwt
encoded_jwt = jwt.encode({'roles': ['feedback', 'chat']}, 'secret', algorithm='HS256')
print(encoded_jwt)
```

Use this token for testing: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJmZWVkYmFjayIsImNoYXQiXX0.d91fM8UyKsP2c_3rJQqrkESudlZPZpTRifidN8jghtI`

## Local postgres

To work with the `/suggest` endpoint, you will need to set up a local postgres. For example...


```sql
CREATE USER someuser WITH PASSWORD 'somepassword';
CREATE DATABASE somedatabase;
GRANT ALL ON DATABASE somedatabase TO someuser;
\c somedatabase someuser
# You are now connected to database "somedatabase" as user "someuser".
GRANT ALL ON SCHEMA public TO someuser;
```

Then, set up your `SQL_CONNECTION_STRING` variable accordingly.

```bash
# .env
SQL_CONNECTION_STRING=postgresql+psycopg://someuser:somepassword@localhost:5432/somedatabase
```

Then run `alembic upgrade head` to run migrations.

## Running alembic

Alembic is used to manage our db version history. It accesses the `.env` used by the API inside `env.py`.

```bash
# Run all of these scripts from the root of the api project.

# reset database
alembic downgrade base && alembic upgrade head

# create migration
alembic revision -m "create suggestion table"
```

## pymssql on Mac OSX

`pymssql` has dependency with **FreeTDS**, as such ensure you install it beforehand `brew install freetds`.

After which if you have issues with running the code please do the following: 

```bash
uv pip uninstall pymssql
myfreetds=$(brew --prefix freetds)
export LDFLAGS="-L$myfreetds/lib"
export CPPFLAGS="-I$myfreetds/include"
uv pip install --pre --no-binary :all: pymssql --no-cache
```

After this all should be working.

## LiteLLM logs in Azure Monitor

## Embedded LiteLLM gateway contract

The LiteLLM gateway is embedded in this API process and exposed through:

- `/proxy/litellm/health`
- `/proxy/litellm/v1/responses`

This route is intentionally thin. It owns HTTP/auth/request-id concerns while LiteLLM helper code owns provider defaults and request shaping. No standalone LiteLLM service is required for local or deployed usage.

The helper layer (`app/api/proxy/litellm_proxy.py`) is intentionally framework-agnostic:

- accepts raw payload objects instead of reading Flask request globals
- accepts raw Authorization header value for bearer extraction
- raises typed validation errors that the route maps to HTTP responses

This keeps migration to a future standalone service mostly to adapter/wiring changes.

Key env vars for this path:

- `LITELLM_GATEWAY_MODE` (`embedded` by default, `standalone_http` placeholder)
- `LITELLM_DEFAULT_MODEL`
- `LITELLM_ALLOWED_MODELS` (optional comma-separated allow-list)
- `LITELLM_JSON_LOGS`
- `LITELLM_INJECT_MCP_TRANSPORT`
- `LITELLM_DEFAULT_MCP_TRANSPORT`
- `LITELLM_FORWARD_CALLER_BEARER_TOKEN`

Note: `standalone_http` mode is intentionally scaffolded for future migration and currently returns a clear runtime error if selected.

When `LITELLM_JSON_LOGS=true`, the embedded LiteLLM gateway emits one-line JSON records that include:

- `event` (`request_start`, `response_done`, `stream_done`, `response_error`)
- `model`, `req_id`, `latency_ms`
- token usage fields (`usage_*`)
- `tools_count`, `tool_names`, `tool_types`

### KQL starter query (date + tool filter)

Use this in Log Analytics. Change the table name depending on your hosting target:

- `AppTraces` (Application Insights)
- `AppServiceConsoleLogs` (App Service)
- `ContainerAppConsoleLogs_CL` (Container Apps)

```kusto
let StartTime = ago(30d);
let SelectedTool = ""; // empty = all tools
AppTraces
| where TimeGenerated >= StartTime
| extend j = parse_json(Message)
| where tostring(j.component) == "litellm_gateway"
| extend tool_names = todynamic(j.tool_names)
| where isempty(SelectedTool) or array_index_of(tool_names, SelectedTool) >= 0
| project
	TimeGenerated,
	event = tostring(j.event),
	model = tostring(j.model),
	req_id = tostring(j.req_id),
	latency_ms = todouble(j.latency_ms),
	usage_total_tokens = toint(j.usage_total_tokens),
	tools_count = toint(j.tools_count),
	tool_names,
	tool_types = todynamic(j.tool_types)
| order by TimeGenerated desc
```

### KQL summary query (tool usage over time)

```kusto
let StartTime = ago(30d);
AppTraces
| where TimeGenerated >= StartTime
| extend j = parse_json(Message)
| where tostring(j.component) == "litellm_gateway"
| where tostring(j.event) in ("response_done", "stream_done")
| mv-expand tool = todynamic(j.tool_names)
| summarize
	requests = count(),
	avg_latency_ms = avg(todouble(j.latency_ms)),
	p95_latency_ms = percentile(todouble(j.latency_ms), 95),
	total_tokens = sum(toint(j.usage_total_tokens))
	by bin(TimeGenerated, 1h), tool = tostring(tool)
| order by TimeGenerated asc
```

### Workbook and export

1. Open Azure Monitor Workbook and add a parameter for time range and selected tool.
2. Paste the starter query in a table visualization.
3. Use Workbook or Log Analytics export to CSV for ad-hoc exports.
4. For recurring export, configure a scheduled query rule or Diagnostic Settings export to Storage/Event Hub.