# Documentation on the management of the App Registration for the SSC Assistant.

|DisplayName|Id|AppId|
|-|-|-|
|Robot conversationnel - Azure OpenAI - Chatbot|fa97a723-f604-438b-8bd6-06543065f6a9|5605426c-1531-4da5-b6b6-2413d57a1446|

## Dev

In powershell run the following commands: 

```powershell
Connect-AzAccount
$app = Get-AzADApplication -DisplayName "Robot conversationnel - Azure OpenAI - Chatbot"
Get-AzADApplication -ObjectId $app.Id
```