# Documentation on the management of the App Registration for the SSC Assistant.

|DisplayName|Id|AppId|
|-|-|-|
|Robot conversationnel - Azure OpenAI - Chatbot|fa97a723-xxxx-xxxx-xxxx-06543065f6a9|5605426c-xxxx-xxxx-xxxx-2413d57a1446|

## Dev

In powershell run the following commands:

```powershell
Connect-AzAccount
$app = Get-AzADApplication -DisplayName "Robot conversationnel - Azure OpenAI - Chatbot"
Get-AzADApplication -ObjectId $app.Id
```

## updating roles

```powershell
Connect-AzureAD
$app_name = "Robot conversationnel - Azure OpenAI - Chatbot"
$sp = Get-AzureADServicePrincipal -Filter "displayName eq '$app_name'"
Get-AzureADServicePrincipalOwner -ObjectId $sp.ObjectId
Get-AzureADServiceAppRoleAssignment -ObjectId $sp.ObjectId
Get-AzureADGroup -Filter "startswith(DisplayName, 'All Users')"

# Replace the following placeholders with actual values
$group = Get-AzureADGroup -ObjectId "<group id>"
$servicePrincipalId = $sp.ObjectId # Object ID for your service principal
# Assign the "All Users" group to the application with default role
New-AzureADServiceAppRoleAssignment -ObjectId $sp.ObjectId -PrincipalId $group.ObjectId -ResourceId $servicePrincipalId -Id ([Guid]::Empty)

```