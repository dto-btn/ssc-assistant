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

### App registration (and IdP) configuration

With Az CLI you can inspect and perfom operation (with App Dev role) on the Application/App Registration: 

```bash
az ad sp list --filter "displayName eq 'SSC-Assistant-Dev'"
az ad sp list --filter "displayName eq 'Robot conversationnel - Azure OpenAI - Chatbot'"
```

#### Powershell management of groups

Dev has the following group currently assigned to it `SEC SSC-Assistant-Dev Enterprise App Users`

To modify users assigned to it do the following:

```powershell
Connect-AzureAD

$assistant_dev_grp = Get-AzureADGroup -SearchString "SEC SSC-Assistant-Dev Enterprise App Users"
$user = Get-AzADUser -Mail someone@ssc-spc.gc.ca

Add-AzADGroupMember -TargetGroupObjectId $assistant_dev_grp.ObjectId -MemberObjectId $user.Id
Get-AzADGroupMember -GroupObjectId $assistant_dev_grp.ObjectId
```