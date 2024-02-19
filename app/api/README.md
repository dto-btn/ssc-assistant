# Backend API for the ssc-assitant.

This api is exposed to the frontend and other teams (MySSC Plus).

## devs

To run the application simply do `cd app/api` then `flask --debug run --port=5001`

### .env

Make sure you populate your `.env` file with the following values: 

```.env
AZURE_SEARCH_SERVICE_ENDPOINT=<domain>
AZURE_SEARCH_ADMIN_KEY=<key>
AZURE_OPENAI_ENDPOINT=<domain>
AZURE_OPENAI_API_KEY=<key>
JWT_SECRET=secret
```

## generating new keys

[Documentation on how to generate a new key](https://pyjwt.readthedocs.io/en/stable/)

```python
import jwt
encoded_jwt = jwt.encode({'roles': ['myssc', 'chat']}, 'secret', algorithm='HS256')
print(encoded_jwt)
```

Use this token for testing: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJteXNzYyIsImNoYXQiXX0.FVUJV6UEOD3wJa4QbAbrFIxAgtMZ-shH7W_G-_5XP_w`