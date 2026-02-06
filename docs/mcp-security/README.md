# MCP Security Layer (Envoy + OPA + Keycloak)

This document describes a self-hosted, Azure-independent security layer for MCP requests using Envoy as the gateway, OPA for authorization, and Keycloak for identity.

## Goals
- Strong authentication and authorization without cloud-managed security checks.
- Centralized policy enforcement (tool allowlists, tenant rules, rate classes).
- Auditable decisions and minimal changes to application code.

## High-level flow
1. Client authenticates with Keycloak and receives a short-lived JWT.
2. Client sends MCP/API requests to Envoy (gateway).
3. Envoy verifies JWT, applies rate limiting, and calls OPA for authorization.
4. If OPA allows, Envoy forwards the request to the MCP server/API.

## Components
- **Envoy**: TLS termination, JWT verification, rate limiting, and external authz calls to OPA.
- **OPA**: Policy decision point. Deny by default, allow based on roles, tools, and request metadata.
- **Keycloak**: Identity provider issuing OIDC JWTs.

Note: Envoy is configured to send up to 8KB of request body to OPA for tool checks; adjust in [docs/mcp-security/envoy.yaml](envoy.yaml) if needed.

## Files in this folder
- [docs/mcp-security/envoy.yaml](envoy.yaml): Example Envoy configuration with JWT and OPA checks.
- [docs/mcp-security/opa.rego](opa.rego): Example policy enforcing tool allowlists and role checks.
- [docs/mcp-security/keycloak.md](keycloak.md): Keycloak setup and token configuration notes.
- [docs/mcp-security/opa-config.yaml](opa-config.yaml): OPA Envoy plugin configuration.
- [docs/mcp-security/docker-compose.yml](docker-compose.yml): Local stack for Envoy, OPA, and Keycloak.

## Integration points
- **API/MCP server**: Trust only requests that come from Envoy. Validate `X-Envoy-Auth` and use `X-User`, `X-Roles` headers set by Envoy.
- **Front-end**: Use Keycloak to get an access token and pass it to Envoy.

## Minimal changes to the API
- Accept `X-User` and `X-Roles` headers from Envoy.
- Enforce a shared secret or mTLS between Envoy and the API.
- Set environment variables:
	- `TRUST_ENVOY_HEADERS=true`
	- `ENVOY_SHARED_SECRET=<shared-secret>`
	- `REQUIRE_ENVOY_AUTH=true` (optional, forces all protected endpoints through Envoy)
	- `AUTH_PROVIDER=keycloak` (optional, validates bearer tokens via Keycloak JWKS)
	- `KEYCLOAK_JWKS_URL=http://localhost:8081/realms/ssc/protocol/openid-connect/certs`
	- `KEYCLOAK_ISSUER=http://localhost:8081/realms/ssc`
	- `KEYCLOAK_AUDIENCE=ssc-mcp`

## Next steps
1. Adjust [docs/mcp-security/envoy.yaml](envoy.yaml) with your Keycloak `issuer` and `jwks_uri`.
2. Customize policies in [docs/mcp-security/opa.rego](opa.rego).
3. Configure Envoy-to-API mTLS if required (see [docs/mcp-security/certs/README.md](certs/README.md)).
4. Update the frontend to acquire tokens from Keycloak.

## Local quickstart
1. Set `ENVOY_SHARED_SECRET` in [docs/mcp-security/docker-compose.yml](docker-compose.yml).
2. Start the stack from the docs folder:
	- `docker compose -f docs/mcp-security/docker-compose.yml up`
3. Configure Keycloak at http://localhost:8081 (realm `ssc`, client `ssc-mcp`).
4. Ensure the issuer is `http://localhost:8081/realms/ssc` and Envoy uses the local JWKS URL (already set in [docs/mcp-security/envoy.yaml](envoy.yaml)).
