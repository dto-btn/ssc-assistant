package mcp.authz

default allow = false

# Example: allow GET /health without authz
allow {
  input.attributes.request.http.method == "GET"
  input.attributes.request.http.path == "/health"
}

# Example: allow chat completion only for role "chat"
allow {
  input.attributes.request.http.method == "POST"
  input.attributes.request.http.path == "/api/1.0/completion/chat"
  has_role("chat")
  tool_allowed
}

# Example: allow MCP tool calls only for explicit role
allow {
  input.attributes.request.http.method == "POST"
  startswith(input.attributes.request.http.path, "/api/1.0/completion")
  has_role("mcp")
  tool_allowed
}

# Tool allowlist: deny by default
allowed_tools := {"corporate", "geds", "pmcoe", "telecom"}

tool_allowed {
  tool := get_tool_from_body
  tool == ""  # if no tool selected, allow by role only
} else {
  tool := get_tool_from_body
  tool != ""
  allowed_tools[tool]
}

# Extract tool name from JSON body (best-effort)
get_tool_from_body := tool {
  body := input.attributes.request.http.body
  is_string(body)
  decoded := json.unmarshal(body)
  tool := decoded.tool
} else := ""

has_role(role) {
  roles := split(lower(input.attributes.request.http.headers["x-roles"]), ",")
  roles[_] == lower(role)
}
