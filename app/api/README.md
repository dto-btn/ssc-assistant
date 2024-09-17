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
encoded_jwt = jwt.encode({'roles': ['feedback', 'chat']}, 'secret', algorithm='HS256')
print(encoded_jwt)
```

Use this token for testing: `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJyb2xlcyI6WyJmZWVkYmFjayIsImNoYXQiXX0.d91fM8UyKsP2c_3rJQqrkESudlZPZpTRifidN8jghtI`
