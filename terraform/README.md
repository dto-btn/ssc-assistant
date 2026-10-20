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

### Frontend Entra ID client-secret rotation

When `enable_auth` is true, Terraform creates and manages the frontend's Entra ID client secret. 
The secret expires after 180 days and is replaced every 150 days, leaving a 30-day buffer before expiry. 
`terraform apply` must run successfully within that buffer for rotation to happen before expiry; 
Terraform does not run on its own. 
Schedule regular applies if unattended rotation is required.

The secret value is stored in Terraform state and in the web app's `MICROSOFT_PROVIDER_AUTHENTICATION_SECRET` setting. 
The first apply creates a Terraform-managed secret and updates the app setting; 
it does not automatically remove any old portal-created secrets.
The identity used by Terraform must have permission to manage credentials on the Entra ID application. 
In the dev configuration, also set `enable_auth = true` and provide the frontend app's `aad_client_id` to manage its secret. 
Remove the old `microsoft_provider_authentication_secret` assignment from any `*.tfvars` files.
