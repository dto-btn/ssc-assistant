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

## Example response


```json
{
    "citations": [
        {
            "title": "Welcome to SSC+",
            "url": "https://plus.ssc-spc.gc.ca/en/news/articles/25-01-2022/welcome-ssc"
        },
        {
            "title": "MySSC+ and Content Transition",
            "url": "https://plus.ssc-spc.gc.ca/en/news/blogs/development/30-03-2022/myssc-and-content-transition"
        },
        {
            "title": "SSC Artificial Intelligence: A Way Forward",
            "url": "https://plus.ssc-spc.gc.ca/en/page/ssc-artificial-intelligence-way-forward"
        }
    ],
    "content": "SSC's content management system is Drupal 9, which is part of the upgraded web platform for the new SSC+ intranet. This system aims to improve how web content is published and managed, enhance user experience, and provide better search engine functionalities [doc1].",
    "id": "4c279c1f-ca32-48ab-895f-d6b5beec7f41",
    "language": "en",
    "original_query": "What is SSC's content management system?",
    "reason": null,
    "requester": "mysscplus",
    "success": true,
    "timestamp": "2026-06-15T10:01:26.461Z"
}
```

## Example callback from MySSC+ search results

This would be the call back used, with the ID from above result, to reach SSCA Suggest presentation page.

* http://localhost:8080/suggest-callback?suggestionContextId=4c279c1f-ca32-48ab-895f-d6b5beec7f41

Or via `curl`: 

```bash
curl --location 'http://localhost:5001/api/1.0/suggest?suggestionContextId=4c279c1f-ca32-48ab-895f-d6b5beec7f41' \
--header 'x-api-key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlcyI6WyJzdWdnZXN0Il19.Nob_YD12KG3OQklU6l1swqQJsVZc62bGOX053LzNk78' \
--header 'Authorization: Bearer dummy'
```