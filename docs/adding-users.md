# Adding Users to a Azure AD Group using Az CLI

This demonstrate how to add users to a group tied to an App Registration in Azure AD via the Azure CLI.

## Azure CLI commands

```bash
appId="5e945d23-123-123-123-123-123-93a9ca58f8aa"
az ad app show --id $appId
objectId=$(az ad sp show --id $appId -o tsv --query id)
# show group tied to appId (direct method, since above method doesn't work)
groupId=$(az ad group list --filter "displayname eq 'SEC SSC-Assistant-Dev Enterprise App Users'" \
-o json --query "[0].id")
memberId=$(az ad user show --id some.one@ssc-spc.gc.ca -o tsv --query id)
az ad group member add --group $groupId --member-id $memberId
```
