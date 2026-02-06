# Keycloak setup notes (local dev)

This guide configures a local Keycloak for the MCP playground integration.

## 1) Log into the admin console
Open http://localhost:8081 and log in with:
- Username: `admin`
- Password: `admin`

## 2) Create a realm
1. Click the realm dropdown (top-left) → **Create realm**.
2. Name: `ssc` → **Create**.

## 3) Create a client
1. Go to **Clients** → **Create client**.
2. Client ID: `ssc-mcp`
3. Client protocol: **OpenID Connect**
4. Root URL: `http://localhost:8080`
5. **Next** → on **Capability config** set:
	- **Client authentication**: Off (this makes it Public)
	- **Authorization**: Off
	- **Standard flow**: On
	- **Direct access grants**: Off
	- **Implicit flow**: Off
	- **Service accounts roles**: Off
	- **Device Grant**: Off
	- **CIBA**: Off
6. **Save**.

### Client settings
In the client settings tab:
- **Valid redirect URIs**: `http://localhost:8080/*`
- **Web origins**: `http://localhost:8080`
- **Standard flow**: Enabled

## 4) Create a role
1. Go to **Realm roles** → **Create role**.
2. Role name: `mcp` → **Save**.

## 5) Create a user
1. Go to **Users** → **Create user**.
2. Username: `testuser` → **Create**.
3. Open the user and set **Email**, **First name**, **Last name**.
	- These are required for first login to complete cleanly in this project.
3. Go to **Credentials** → set a password, disable temporary.
4. Go to **Role mapping** → **Assign role**.
5. In the dialog, switch **Filter by** from *Clients* to *Realm roles*.
6. Select `mcp` and **Assign**.

> End users should not log into Keycloak admin. They only see the standard Keycloak login page when the app redirects for authentication.

## 6) Token claims
### Add `roles` to the access token
1. Go to **Client scopes** → **roles** → **Mappers**.
2. **Add mapper** → **By configuration** → **User Realm Role**.
3. Set **Token Claim Name** = `roles`.
4. Set **Add to access token** = On (ID token optional).
5. **Save**.

### Ensure `preferred_username` is present
1. Go to **Client scopes** → **profile** → **Mappers**.
2. If `preferred_username` already exists, nothing to do.
3. Otherwise: **Add mapper** → **By configuration** → **User property**.
4. **Property** = `username`
5. **Token Claim Name** = `preferred_username`
6. **Add to access token** = On
7. **Save**.

## 7) Envoy JWT settings
These are already set for local dev in [docs/mcp-security/envoy.yaml](envoy.yaml):
- `issuer`: `http://localhost:8081/realms/ssc`
- `jwks_uri`: `http://host.docker.internal:8081/realms/ssc/protocol/openid-connect/certs`
- `audiences`: `ssc-mcp`

## 8) Frontend env
Set in [app/frontend/.env](../../app/frontend/.env):
- `VITE_AUTH_PROVIDER=keycloak`
- `VITE_KEYCLOAK_URL=http://localhost:8081`
- `VITE_KEYCLOAK_REALM=ssc`
- `VITE_KEYCLOAK_CLIENT_ID=ssc-mcp`

## 9) Quick verification
After logging into the playground, open the browser devtools and confirm the access token contains:
- `roles: ["mcp"]`
- `preferred_username`
