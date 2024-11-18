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

oauth_validator = OAuth2TokenValidation(tenant_id, client_id)

@auth.verify_token
def verify_token(token):
    try:
        # Decode the token using the same secret key and algorithm used to encode
        data = jwt.decode(token, secret, algorithms=['HS256'])
        # Store the decoded token data in the Flask's global user object
        if 'roles' in data:
            g.roles = data['roles']
            return True
        else:
            return False
    except jwt.ExpiredSignatureError:
        # Signature has expired
        return False
    except jwt.InvalidTokenError:
        # Invalid token
        return False

@auth.get_user_roles
def get_user_roles(user):
    return g.roles

@user_ad.verify_token
def verify_user_access_token(token):
    if os.getenv("SKIP_USER_VALIDATION", "False").lower() == "true":
        logger.info("Skipping User Validation")
        return True
    try:
        #https://learn.microsoft.com/en-us/entra/identity-platform/id-token-claims-reference#payload-claims
        user = oauth_validator.validate_token_and_decode_it(token)
        if user:
            return user
    except Exception as e:
        logger.error("Unable to validate user %s", e) # pylint: disable=broad-except
