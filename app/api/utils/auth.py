import os
import jwt
from flask import g

from flask_httpauth import HTTPTokenAuth

__all__ = [ "auth" ]

auth = HTTPTokenAuth(header='X-API-Key')

secret = os.getenv('JWT_SECRET', 'secret')

@auth.verify_token
def verify_token(token):
    print("Received token:", token)
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