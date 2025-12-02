import logging
import os

import jwt
from flask import g
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

_API_SCOPE = os.getenv('API_SCOPE', 'api.access')
_API_APP_SCOPE = os.getenv('API_APP_SCOPE', 'api.access.app')
_skip_user_validation = os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true"
oauth_validator = None if _skip_user_validation else OAuth2TokenValidation(tenant_id, client_id)

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

@auth.verify_token
def verify_token(token):
    """
    this is the validatation method for the X-Api-key header token. Contains the roles for the user

    NOTE: would much prefer just using scopes for access control but right now, it's hard for us to control this aspect.
    """
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
    user = get_or_create_user()
    if os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true":
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
