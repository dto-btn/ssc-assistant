# Suggestion feature documentation

This documents the `/api/suggest` endpoints created mainly for **MySSC+** Drupal portal.

## Pre-requisites

For development and testing this API endpoint you will need to have an API access token (different than the Oauth token)
that has the `suggest` role attached to it, here is how to create one for testing purpose (update the secret for whatever you use locally): 

```python
import jwt
encoded_jwt = jwt.encode({'roles': ['suggest',]}, 'secret', algorithm='HS256')
print(encoded_jwt)
```

Use this token for the `X-API-Token` value.

## Testing the suggest endpoint: 

```bash
curl --location 'http://localhost:5001/api/1.0/suggest/stream' \
--header 'x-api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlcyI6WyJzdWdnZXN0Il19.Nob_YD12KG3OQklU6l1swqQJsVZc62bGOX053LzNk78' \
--header 'Authorization: Bearer dummy' \
--header 'Content-Type: application/json' \
--data '{
  "opts": {
    "language": "en",
    "requester": "mysscplus"
  },
  "query": "What is SSC'\''s content management system?"
}'
```