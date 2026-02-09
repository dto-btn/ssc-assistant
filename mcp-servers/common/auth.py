import os
import time
import jwt
import base64
import json
import logging
from urllib.request import urlopen
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from starlette.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)

class OAuth2TokenValidation:
    """
    Validates Microsoft Entra ID (Azure AD) tokens.
    """
    def __init__(self, tenant_id, client_id):
        self.jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
        # Azure AD common issuer format. For multi-tenant, use https://login.microsoftonline.com/common/v2.0
        self.issuer_url = f"https://sts.windows.net/{tenant_id}/"
        self.audience = client_id
        self.jwks = None
        self.last_jwks_public_key_update = 0

    def _fetch_jwks(self):
        try:
            self.jwks = json.loads(urlopen(self.jwks_url).read())
            self.last_jwks_public_key_update = time.time()
        except Exception as e:
            logger.error(f"Failed to fetch JWKS: {e}")
            raise

    def validate_token_and_decode_it(self, token):
        """
        Validates the JWT token against Azure AD JWKS.
        """
        if not self.jwks or (time.time() - self.last_jwks_public_key_update > 3600):
            self._fetch_jwks()

        try:
            unverified_header = jwt.get_unverified_header(token)
            rsa_key = self.find_rsa_key(self.jwks, unverified_header)
            if not rsa_key:
                # Try refreshing JWKS once
                self._fetch_jwks()
                rsa_key = self.find_rsa_key(self.jwks, unverified_header)
                if not rsa_key:
                    raise Exception("No matching key found in JWKS")

            public_key = self.rsa_pem_from_jwk(rsa_key)
            return jwt.decode(
                token,
                public_key,
                verify=True,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer_url
            )
        except Exception as e:
            logger.error(f"Token validation failed: {e}")
            return None

    @staticmethod
    def find_rsa_key(jwks, unverified_header):
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                return key
        return None

    @staticmethod
    def rsa_pem_from_jwk(jwk):
        return RSAPublicNumbers(
            n=int.from_bytes(base64.urlsafe_b64decode(jwk['n'] + '=='), 'big'),
            e=int.from_bytes(base64.urlsafe_b64decode(jwk['e'] + '=='), 'big')
        ).public_key(default_backend()).public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

class MSALAuthMiddleware(BaseHTTPMiddleware):
    """
    Starlette middleware for validating MSAL tokens.
    Leverages the same Azure AD validation logic as the main SSC Assistant API.
    """
    def __init__(self, app):
        super().__init__(app)
        # These should match the values used in app/api/.env
        self.tenant_id = os.getenv('AZURE_AD_TENANT_ID')
        self.client_id = os.getenv('AZURE_AD_CLIENT_ID')
        self.skip_auth = os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true"
        
        # We leverage the same 'api.access' scope defined in the main API's auth.py
        self.api_scope = os.getenv('API_SCOPE', 'api.access')
        
        if not self.skip_auth and self.tenant_id and self.client_id:
            logger.info(f"MSAL Security initialized for MCP (Tenant: {self.tenant_id})")
            self.validator = OAuth2TokenValidation(self.tenant_id, self.client_id)
        else:
            self.validator = None
            if not self.skip_auth:
                logger.warning("MCP Security: AZURE_AD_TENANT_ID or AZURE_AD_CLIENT_ID is missing.")

    async def dispatch(self, request, call_next):
        # Always allow OPTIONS (CORS preflight) and skip if configured
        if request.method == "OPTIONS" or self.skip_auth:
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return JSONResponse({"detail": "Missing or invalid authorization header"}, status_code=401)

        token = auth_header.split(" ")[1]
        
        if not self.validator:
            return JSONResponse({"detail": "Authenticator not configured"}, status_code=500)

        decoded_token = self.validator.validate_token_and_decode_it(token)
        if not decoded_token:
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)

        # Validate Scope
        scp = decoded_token.get("scp", "")
        # Check both individual scopes (standard user tokens) and roles (app tokens)
        has_access = False
        if self.api_scope in scp.split(" "):
            has_access = True
        else:
            roles = decoded_token.get("roles", [])
            if self.api_scope in roles or "api.access" in roles:
                has_access = True

        if not has_access:
            logger.warning(f"Insufficient permissions for user. Scope: {scp}, Roles: {decoded_token.get('roles')}")
            return JSONResponse({"detail": "Insufficient permissions"}, status_code=403)

        return await call_next(request)
