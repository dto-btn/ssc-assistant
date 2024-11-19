# Azure Application Configuration

This chatbot leverage the Azure Application/Application Registration. User are authenticated via Microsoft Entra ID
and the authorization is done via OAuth2 scopes.

## Developpers

This will demonstrate how to perform **some** of the `az cli` configuration changes needed for the App Registration.

You must ensure you have `Owner` Role on the *Application registration/Application* before being able to run those 
commands.

### Basic configuration

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
  "oauth2Permissions": [
    {
      "adminConsentDescription": "Access to the API",
      "adminConsentDisplayName": "API Access",
      "id": "<unique-uuid>",
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

### Terraform changes

Required changes for this above update for `terraform` are all in the `api.tf` file. Client ID needs to match the api.

```terraform
AZURE_AD_CLIENT_ID            = "api://<uuid>"
```

And for the `frontend.tf` the scope requested needs to be appropriate.