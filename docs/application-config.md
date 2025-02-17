# Azure Application Configuration

This chatbot leverage the Azure Application/Application Registration. User are authenticated via Microsoft Entra ID
and the authorization is done via OAuth2 scopes.

## Developpers

This will demonstrate how to perform **some** of the `az cli` configuration changes needed for the App Registration.

You must ensure you have `Owner` Role on the *Application registration/Application* before being able to run those
commands.

### Basic configuration

This is the configuration for the App Registration that will affect the end-users.

Documentation [is found here](https://learn.microsoft.com/en-us/cli/azure/ad/app?view=azure-cli-latest)

```bash
# display current configs
az ad app show --id 12345678-1234-1234-1234-1234567890ab

# update basic flags to false
az ad app update --id <your-app-id> --enable-id-token-issuance true
az ad app update --id <your-app-id> --enable-access-token-issuance false
touch api-scope.json
uuidgen
```

And paste the content:

```json
{
  "oauth2PermissionScopes": [
    {
      "adminConsentDescription": "Access to the API",
      "adminConsentDisplayName": "API Access",
      "id": "<uuid-generated-above>",
      "isEnabled": true,
      "type": "User",
      "userConsentDescription": "Allow the application to access the SSC Assistant API on your behalf.",
      "userConsentDisplayName": "Access SSC Assistant API",
      "value": "api.access"
    }
  ]
}
```

And then run:

```bash
az ad app update --id <your-app-id> --identifier-uris api://<your-app-id>
az ad app update --id <your-app-id> --set api=@api-scope.json --debug

az ad app permission grant --id <your-app-id> --api <your-app-id> --scope api.access
# OR
az ad app permission add --id <your-app-id> --api <your-app-id> --api-permissions <unique-uuid>=Scope
```

#### Terraform changes

Required changes for this above update for `terraform` are all in the `api.tf` file. Client ID needs to match the api.

```terraform
AZURE_AD_CLIENT_ID            = "api://<uuid>"
```

And for the `frontend.tf` the scope requested needs to be appropriate.


### Application specific scope

This is an extra step that shows how to add an extra scope that would be used **by other applications only** (i.e. MySSC+ Drupal App) in the confidential client auth flow. For application only we use AppRoles instead of the API scopes as normal, the scopes (shown in `value`) will still be provided in the access token.


```json
[
    {
        "allowedMemberTypes": [
            "Application"
        ],
        "description": "Access to the SSC Assistant API for applications",
        "displayName": "API Access for Application",
        "isEnabled": true,
        "value": "api.access.app"
    }
]
```

And then add it `az ad app update --id <app-id> --app-roles @appRoles.json`

Note: [this is validated against this schema, search for appRole](https://graph.microsoft.com/v1.0/$metadata#applications)

#### Granting Application the role

Now that you have this new appRole defined, you can assign it to a specific application, in order to allow it to access it.

Here is one would do that using the `az` CLI.

```bash
az ad app permission add --id $CLIENT_SP_ID --api $API_SP_ID --api-permissions <your-app-role-id>=Role
# grant might be needed after that ... (see console message)
az ad app permission grant --id $CLIENT_SP_ID --api $API_SP_ID --scope api.access.app
# verify and validate it has been granted
az ad app permission list-grants --id $CLIENT_SP_ID
```

### Modifications to SPA Redirect URIS (and web Redirect URIs)

NOTE: This is not supported by the current `az app update` CLI. Need to use graph API instead:

[See this thread](https://github.com/Azure/azure-cli/issues/25766)

```bash
az rest \
  --method "patch" \
  --uri "https://graph.microsoft.com/v1.0/applications/<appId>" \
  --headers "{'Content-Type': 'application/json'}" \
  --body "{'spa': {'redirectUris': ['https://assistant.ssc-spc.gc.ca']}}"
  ```

And for web ones (space separated URLs):

```bash
az ad app update --id <appId> \
  --web-redirect-uris https://assistant.ssc-spc.gc.ca/.auth/login/aad/callback
```