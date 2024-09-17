# Infrastructure setup

## Documentation

* [How to request certificates (for internet facing not using BCA/F5 flow)](https://www.gcpedia.gc.ca/wiki/Getting_SSL_Certificates_for_servers)

### Secret

In order to spin up this environement you currently need to at least have `secret.tfvars` defined in order to pass the JTW token secret that is used to decrypt the access tokens.

```bash
touch secret.tfvars
echo 'jwt_secret = "THE_SECRET"' > secret.tfvars
<<<<<<< Updated upstream
=======
```

### Rotating keys for needed secrets

Search Service still has a code limitation that I need to provide dev with a secret so we need to rotate it when Dev leaves: 

`az search admin-key renew --name "MySearchService" --resource-group "MyResourceGroup" --key-kind secondary` or via Azure Portal.

### App registration configuration

With Az CLI you can inspect and perfom operation (with App Dev role) on the Application/App Registration: 

```bash
az ad sp list --filter "displayName eq 'SSC-Assistant-Dev'"
az ad sp list --filter "displayName eq 'Robot conversationnel - Azure OpenAI - Chatbot'"
>>>>>>> Stashed changes
```