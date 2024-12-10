import json
import logging
import os
import jwt
import requests
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
        self.user_id = None
        self.load_environment_vars()
        self.configure_logger()

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

    def get_user_id(self):
        self.user_id = "CODY.ROBILLARD@SSC-SPC.GC.CA" #TODO get user's email from other part of the system

    def configure_logger(self):
        logging.basicConfig(level=logging.DEBUG)
        self.logger = logging.getLogger(__name__)

    def get_access_token(self):
        response = requests.post(self.token_url, data=self.token_data)
        if response.status_code == 200:
            return response.json().get('access_token')
        else:
            raise Exception(f"Failed to obtain token: {response.text}")

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

    def get_user_profile_by_id(self, azure_token):
        # Assuming the API URL for users is on the default_url
        self.get_user_id()
        user_url = f"{self.default_url}v1/user/{self.user_id}"

        # Get the access token to authenticate the request
        headers = {
            'Authorization': f'Bearer {azure_token}',
            'Content-Type': 'application/json',
            'email': f'{self.user_id}'
        }

        # Make the request to the API endpoint
        response = requests.get(user_url, headers=headers)
        if response.status_code == 200:
            return response.json()  # Return the user's data
        else:
            self.logger.error(f"Failed to get user with ID {self.user_id}: {response.text}")
            response.raise_for_status()  # Raises an HTTPError if the HTTP request returned an unsuccessful status code



if __name__ == '__main__':
    auth_token = AzureAuthToken()
    try:
        token = auth_token.get_access_token()
        audience = f"api://{auth_token.client_id}"
        auth_token.logger.debug("Access Token acquired!")
        decoded_jwt = auth_token.verify_jwt(token, audience)
        auth_token.logger.debug(f"Decoded JWT: {json.dumps(decoded_jwt, indent=4)}")
        user_profile = auth_token.get_user_profile_by_id(token)
        auth_token.logger.debug(f"Validated User Profile: {json.dumps(user_profile, indent=4)}")

    except Exception as e:
        auth_token.logger.error("An error occurred:", str(e))

