# Infrastructure setup

## Documentation

* [How to request certificates (for internet facing not using BCA/F5 flow)](https://www.gcpedia.gc.ca/wiki/Getting_SSL_Certificates_for_servers)

### Secret

In order to spin up this environement you currently need to at least have `secret.tfvars` defined in order to pass the JTW token secret that is used to decrypt the access tokens.

```bash
touch secret.tfvars
echo 'jwt_secret = "THE_SECRET"' > secret.tfvars
```

### Rotating keys for needed secrets

Search Service still has a code limitation that I need to provide dev with a secret so we need to rotate it when Dev leaves: 

`az search admin-key renew --name "MySearchService" --resource-group "MyResourceGroup" --key-kind secondary` or via Azure Portal.

### Frontend authentication without client secrets

Both [production](./frontend.tf) and [dev](./dev/frontend.tf) use App Service
authentication with a dedicated user-assigned managed identity when `enable_auth`
is true. A federated identity credential on the existing `aad_client_id` app
registration trusts that identity's principal ID. The app registration and managed
identity must belong to the same Entra tenant.

App Service uses the identity's client ID in the slot-sticky
`OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID` setting instead of a client secret. The
existing frontend identity remains attached for other uses. Do not attach the
new authentication identity to other apps or resources: doing so would allow
them to authenticate as this app registration.

There is no client secret to expire or rotate and no scheduled Terraform apply
is needed for credential renewal. Azure manages the identity's credentials.
When `enable_auth` is false, Terraform does not create the authentication identity
or federated credential, and does not add the override setting.

#### Permissions and migration

1. The Terraform identity needs permission to create and assign a user-assigned
   identity and to manage federated credentials on the existing app registration.
   For service-principal authentication, the AzureAD provider supports the Graph
   application permission `Application.ReadWrite.OwnedBy` with ownership of the
   app registration, or `Application.ReadWrite.All`. Azure subscription Contributor
   alone does not grant these Entra permissions.
2. Remove `microsoft_provider_authentication_secret` from tfvars and pipeline
   inputs; it is no longer used. Keep the existing Entra client secret available
   for rollback until sign-in has been verified. For dev, supply the dev app
   registration's `aad_client_id`.
3. Run `terraform init` and review a plan in dev first, then production. Supply
   the existing required variables and certificate files as usual. The plan
   should create the authentication identity and federated credential, attach
   the identity, replace the secret app setting with the identity client ID, and
   change Easy Auth's `client_secret_setting_name` to the override setting.
   Terraform creates the federated credential before updating the web app.
4. Apply and test a fresh sign-in in a private browser session, authenticated
   access to the app, and sign-out. Entra federation changes can take time to
   propagate; allow for this during the deployment window. App setting changes
   can restart App Service.
5. After successful verification, delete only the old client secret used by this
   frontend from the app registration. Terraform does not delete existing Entra
   client secrets; other applications may still depend on them. For rollback,
   restore the previous Terraform configuration and supply a still-valid client
   secret, then review and apply that plan. Previously stored secret values can
   remain in historical Terraform state versions; continue to protect state.

See Microsoft's [App Service managed-identity authentication instructions](https://learn.microsoft.com/en-us/azure/app-service/configure-authentication-provider-aad#use-a-managed-identity-instead-of-a-secret).

#### Configuration tests

Run `terraform test` from this directory to exercise enabled and disabled
authentication with mocked Azure providers in [the authentication suite](./tests/frontend_auth.tftest.hcl).
The existing certificate file references must still resolve for Terraform to
validate the configuration. These tests do not replace a live sign-in check.