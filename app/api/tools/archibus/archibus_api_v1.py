import json
import logging
import os
import jwt
import requests
import datetime

from jwt import PyJWKClient
from dotenv import load_dotenv

class AzureAuthToken:
    def __init__(self):
        self.logger = None
        self.token_data = None
        self.jwks_url = None
        self.issuer_url = None
        self.token_url = None
        self.default_url = None
        self.application_id = None
        self.client_secret = None
        self.client_id = None
        self.tenant_id = None
        self.token_info = {}
        self.load_environment_vars()
        self.configure_logger()
        self.generate_token()

    def load_environment_vars(self):
        load_dotenv()
        self.tenant_id = os.getenv('ARCHIBUS_API_V1_TENANT')
        self.client_id = os.getenv('ARCHIBUS_API_V1_CLIENT')
        self.client_secret = os.getenv('ARCHIBUS_API_V1_CLIENT_SECRET')
        self.application_id = os.getenv('ARCHIBUS_API_V1_APPLICATION_ID')
        self.default_url = os.getenv('ARCHBIUS_API_V1_URL')
        self.token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        self.issuer_url = f"https://sts.windows.net/{self.tenant_id}/"
        self.jwks_url = f"https://login.microsoftonline.com/{self.tenant_id}/discovery/v2.0/keys"
        self.token_data = {
            'grant_type': 'client_credentials',
            'client_id': self.client_id,
            'client_secret': self.client_secret,
            'scope': f'api://{self.client_id}/.default',
        }


    def configure_logger(self):
        logging.basicConfig(level=logging.ERROR)
        self.logger = logging.getLogger(__name__)

    def generate_token(self):
        response = requests.post(self.token_url, data=self.token_data)
        if response.status_code == 200:
            token_json = response.json()
            self.token_info['access_token'] = token_json.get('access_token')
            self.token_info['expires_on'] = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
                seconds=int(token_json.get('expires_in')))
            self.logger.debug("Token generated successfully")
        else:
            self.logger.error("Failed to obtain token: " + response.text)

    def get_access_token(self):
        # Check if token_info is empty or the token has expired, and regenerate it if necessary
        if not self.token_info or datetime.datetime.now(datetime.UTC) >= self.token_info.get('expires_on',
                                                                                    datetime.datetime.now(datetime.UTC)):
            self.generate_token()
        return self.token_info['access_token']

    def get_archibus_url(self):
        return self.default_url

    def verify_jwt(self, token, audience):
        jwk_client = PyJWKClient(self.jwks_url)
        signing_key = jwk_client.get_signing_key_from_jwt(token)

        try:
            data = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=audience,
                issuer=self.issuer_url
            )
            return data
        except jwt.InvalidAudienceError:
            raise Exception("Invalid audience claim")
        except jwt.InvalidIssuerError:
            raise Exception("Invalid issuer claim")
        except jwt.InvalidSignatureError:
            raise Exception("Signature verification failed")
        except jwt.DecodeError:
            raise Exception("Error decoding token")
        except jwt.InvalidTokenError:
            raise Exception("Invalid token")


if __name__ == '__main__':
    auth_token = AzureAuthToken()
    try:
        # Use the token from auth_token instance when needed
        token = auth_token.get_access_token()
        audience = f"api://{auth_token.client_id}"
        auth_token.logger.debug("Access Token acquired!")
        decoded_jwt = auth_token.verify_jwt(token, audience)
        auth_token.logger.err(f"Decoded JWT: {json.dumps(decoded_jwt, indent=4)}")

    except Exception as e:
        auth_token.logger.error("An error occurred: " + str(e))

