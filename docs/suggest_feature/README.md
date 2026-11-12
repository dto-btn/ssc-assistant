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

Set `SSC_API_KEY` in your local shell to the API access token generated above.
The curl examples below expand this environment variable; do not commit its value.
In Bash, you can enter it without saving the token in shell history:

```bash
read -r -s -p 'API access token: ' SSC_API_KEY
printf '\n'
export SSC_API_KEY
```

### Non-streaming

```bash
curl --location 'http://localhost:5001/api/1.0/suggest' \
--header "x-api-key: ${SSC_API_KEY}" \
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

### Streaming

Add `?stream=true` to the URL. The response is streamed as NDJSON (`application/x-ndjson`).
Each line during generation is a content chunk: `{"content": "delta text"}`.
The last line is the complete response object (same shape as the non-streaming response).

```bash
curl --location 'http://localhost:5001/api/1.0/suggest?stream=true' \
--header "x-api-key: ${SSC_API_KEY}" \
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

Streaming response example (each line is a JSON object):
```
{"content": "SSC's content "}
{"content": "management system "}
{"content": "is Drupal 9..."}
{"success": true, "language": "en", "original_query": "...", "content": "SSC's content management system is Drupal 9...", "citations": [...], ...}
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

### Playground hand-off

The external URL remains `/suggest-callback?suggestionContextId=<uuid>`.
MySSC++ does not need to change its links. The callback validates the saved API
response before handing it to the chat through navigation state.

With `VITE_PLAYGROUND_ON=true`, the callback opens `/playground`. Otherwise it
continues to open legacy chat at `/`. The playground also consumes the same
hand-off when it is mounted at `/` during the main-chat cutover; keep the callback
and `/playground` routes registered during that rollout.

A successful hand-off creates a new sidebar conversation named after the original
question, containing the question, saved answer, and native citation chips/drawer.
It does not generate another answer or reuse an existing empty draft. The answer's
`language` selects the playground's English or French interface. Existing
conversations are preserved.

The completed conversation is saved immediately to local storage and submitted
to the existing archive/outbox mechanism. Navigation state is replaced with only
the imported session ID, so refreshing restores that conversation without fetching
or importing the answer again. A separate visit to the callback intentionally
creates another conversation, even for the same question.

Missing identifiers, API failures (`success: false`), invalid response shapes, and
network/unknown failures display persistent errors in the selected interface
language (English or French). Local-save failures also display an explicit warning.
Language changes are saved in the shared language-preference cookie, so opening
the callback through a full-page navigation preserves the selected interface
language even when the link is missing its suggestion identifier.

#### Validation

From `app/frontend`, run the suggestion model, callback integration, import thunk,
and session bootstrap tests with Vitest. Browser coverage is in
`tests/e2e/playground-suggestion.spec.ts`; it uses the standard authenticated test
entrypoint and mocked saved API responses at the unchanged callback URL.
See `app/frontend/tests/README.md` for Playwright setup.

Before deploying, also verify a real saved suggestion in dev/staging:

1. Create a suggestion using the authenticated POST example above and copy its ID.
2. Sign in to SSC Assistant and open `/suggest-callback?suggestionContextId=<id>`.
3. Check the original question, answer, title, citations, and answer language.
4. Refresh immediately; confirm the conversation remains and is not duplicated.
5. Send a follow-up question and confirm normal chat still works.
6. Repeat in French and verify each error case with controlled API responses.

### Fetching a saved suggestion directly

Via `curl`:

```bash
curl --location 'http://localhost:5001/api/1.0/suggest?suggestionContextId=4c279c1f-ca32-48ab-895f-d6b5beec7f41' \
--header "x-api-key: ${SSC_API_KEY}" \
--header 'Authorization: Bearer dummy'
```