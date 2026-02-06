import hmac
import logging
import os

import jwt
from jwt import PyJWKClient
from flask import g, request
from flask_httpauth import HTTPTokenAuth
from utils.oauth_validation import OAuth2TokenValidation

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

__all__ = [ "auth", "user_ad" ]

auth = HTTPTokenAuth(header='X-API-Key')
user_ad = HTTPTokenAuth(header='Authorization', scheme='Bearer')

tenant_id = os.getenv('AZURE_AD_TENANT_ID')
client_id = os.getenv('AZURE_AD_CLIENT_ID')
secret = os.getenv('JWT_SECRET', 'secret')

_trust_envoy_headers = os.getenv("TRUST_ENVOY_HEADERS", "False").lower() == "true"
_envoy_shared_secret = os.getenv("ENVOY_SHARED_SECRET", "")
_require_envoy_auth = os.getenv("REQUIRE_ENVOY_AUTH", "False").lower() == "true"

_API_SCOPE = os.getenv('API_SCOPE', 'api.access')
_API_APP_SCOPE = os.getenv('API_APP_SCOPE', 'api.access.app')
_skip_user_validation = os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true"
# To disable the network-heavy validator for local development and pytest flows, set SKIP_USER_VALIDATION=true in your .env file.
oauth_validator = None if _skip_user_validation else OAuth2TokenValidation(tenant_id, client_id)

_auth_provider = os.getenv("AUTH_PROVIDER", "azure").lower()
_keycloak_jwks_url = os.getenv("KEYCLOAK_JWKS_URL")
_keycloak_issuer = os.getenv("KEYCLOAK_ISSUER")
_keycloak_audience = os.getenv("KEYCLOAK_AUDIENCE")

class User:
    """User object used to pass around accesstoken and apitoken"""
    def __init__(self, api_key=None, token=None, roles=None):
        self.api_key = api_key
        self.token = token
        self.roles = roles

def get_or_create_user():
    """tries to get the user from the global context or creates a new one"""
    if not hasattr(g, 'user'):
        g.user = User()
    return g.user

def _get_envoy_roles() -> list[str]:
    roles_header = request.headers.get("X-Roles", "")
    if not roles_header:
        return []
    return [role.strip() for role in roles_header.split(",") if role.strip()]

def _envoy_headers_trusted() -> bool:
    if not _trust_envoy_headers:
        return False
    if not _envoy_shared_secret:
        return False
    provided_secret = request.headers.get("X-Envoy-Auth", "")
    if not provided_secret:
        return False
    return hmac.compare_digest(provided_secret, _envoy_shared_secret)

def _apply_envoy_identity() -> User:
    user = get_or_create_user()
    user.api_key = "envoy"
    user.token = {
        "sub": request.headers.get("X-User"),
        "roles": _get_envoy_roles(),
    }
    user.roles = user.token["roles"]
    return user

def _verify_keycloak_token(token: str):
    if not _keycloak_jwks_url:
        return False
    try:
        jwks_client = PyJWKClient(_keycloak_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token).key
        options = {"verify_aud": bool(_keycloak_audience)}
        decoded_token = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=_keycloak_audience if _keycloak_audience else None,
            issuer=_keycloak_issuer if _keycloak_issuer else None,
            options=options,
        )

        roles = []
        realm_access = decoded_token.get("realm_access", {}) if isinstance(decoded_token, dict) else {}
        if isinstance(realm_access, dict) and realm_access.get("roles"):
            roles = realm_access.get("roles", [])
        elif isinstance(decoded_token, dict) and decoded_token.get("roles"):
            roles = decoded_token.get("roles", [])

        user = get_or_create_user()
        user.token = decoded_token
        user.roles = roles
        return user
    except Exception as e:  # pylint: disable=broad-except
        logger.error("Unable to validate Keycloak token: %s", e)
        return False

@auth.verify_token
def verify_token(token):
    """
    this is the validatation method for the X-Api-key header token. Contains the roles for the user

    NOTE: would much prefer just using scopes for access control but right now, it's hard for us to control this aspect.
    """
    if _envoy_headers_trusted():
        return _apply_envoy_identity()
    if _require_envoy_auth:
        return None
    try:
        # Decode the token using the same secret key and algorithm used to encode
        data = jwt.decode(token, secret, algorithms=['HS256'])
        # Store the decoded token data in the Flask's global user object
        if 'roles' in data:
            user = get_or_create_user()
            user.api_key = token
            user.roles = data['roles']
            return user
        else:
            return None
    except jwt.ExpiredSignatureError:
        # Signature has expired
        return None
    except jwt.InvalidTokenError:
        # Invalid token
        return None

@auth.get_user_roles
def get_user_roles(user: User):
    """retrieve the roles from the user object"""
    return user.roles

@user_ad.verify_token
def verify_user_access_token(token):
    """verify the access token provided in the Authorization header"""
    if _envoy_headers_trusted():
        return _apply_envoy_identity()
    if _require_envoy_auth:
        return None
    if _auth_provider == "keycloak" or _keycloak_jwks_url:
        return _verify_keycloak_token(token)
    user = get_or_create_user()
    if os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true":
        # Tests inject fake identities, so short-circuit instead of hitting Entra ID.
        logger.info("Skipping User Validation")
        user.token = None
        return user
    try:
        global oauth_validator  # pylint: disable=global-statement
        if oauth_validator is None:
            oauth_validator = OAuth2TokenValidation(tenant_id, client_id)
        #https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
        decoded_token = oauth_validator.validate_token_and_decode_it(token)
        if decoded_token and 'scp' in decoded_token and decoded_token['scp'] == _API_SCOPE:
            user.token = decoded_token
            return user
        elif decoded_token and 'roles' in decoded_token and _API_APP_SCOPE in decoded_token['roles']:
            user.token = decoded_token
            return user
        else:
            raise ValueError("Invalid scope or user")
    except Exception as e:
        logger.error("Unable to validate user: %s", e) # pylint: disable=broad-except
        return False
