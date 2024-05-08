import time
import jwt
import base64
from cryptography.hazmat.primitives.asymmetric.rsa import RSAPublicNumbers
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
import json
from urllib.request import urlopen

class OAuth2TokenValidation:

    def __init__(self, tenant_id, client_id):
        # those are obtained via: https://login.microsoftonline.com/{tenant_id}/v2.0/.well-known/openid-configuration
        self.jwks_url = f"https://login.microsoftonline.com/{tenant_id}/discovery/v2.0/keys"
        self.issuer_url = f"https://login.microsoftonline.com/{tenant_id}/v2.0"
        #self.audience = f"api://{client_id}"
        self.audience = client_id

        self.jwks = json.loads(urlopen(self.jwks_url).read())
        self.last_jwks_public_key_update = time.time()

    def validate_token_and_decode_it(self, token):
        """
        :param token: the jwt token to validate
        :return: the decoded token if valid, else raises an exception
        """

        try:
            unverified_header = jwt.get_unverified_header(token)
            print(f"HEADERS: {unverified_header}")
        except Exception as e:
            raise Exception(f"Unable to decode authorization token headers: {e}")

        try:
            rsa_key = OAuth2TokenValidation.find_rsa_key(self.jwks, unverified_header)
            print(rsa_key)
            public_key = OAuth2TokenValidation.rsa_pem_from_jwk(rsa_key)
            print(public_key)

            print(token)

            return jwt.decode(
              token,
              public_key,
              verify=True,
              algorithms=["RS256"],
              audience=self.audience,
              issuer=self.issuer_url
            )

        except jwt.ExpiredSignatureError:
            raise Exception("Token has expired")
        except jwt.InvalidTokenError as e:
            print(e)
            raise Exception("Invalid token")
        except Exception as e:
            # update the public key if not fresh and try again
            if int(time.time() - self.last_jwks_public_key_update) > 60:
                self.jwks = json.loads(urlopen(self.jwks_url).read())
                self.last_jwks_public_key_update = time.time()
                return self.validate_token_and_decode_it(token)
            else:
                print(f"Error validating token: {e}")

    @staticmethod
    def find_rsa_key(jwks, unverified_header):
        for key in jwks["keys"]:
            if key["kid"] == unverified_header["kid"]:
                return {
                  "kty": key["kty"],
                  "kid": key["kid"],
                  "use": key["use"],
                  "n": key["n"],
                  "e": key["e"]
                }

    @staticmethod
    def ensure_bytes(key):
        if isinstance(key, str):
            key = key.encode('utf-8')
        return key

    @staticmethod
    def decode_value(val):
        decoded = base64.urlsafe_b64decode(OAuth2TokenValidation.ensure_bytes(val) + b'==')
        return int.from_bytes(decoded, 'big')

    @staticmethod
    def rsa_pem_from_jwk(jwk):
        return RSAPublicNumbers(
            n=OAuth2TokenValidation.decode_value(jwk['n']),
            e=OAuth2TokenValidation.decode_value(jwk['e'])
        ).public_key(default_backend()).public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )