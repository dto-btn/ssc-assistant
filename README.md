# SSC Assistant
Second iteration of the SSC chatbot/assistant.

## Developper(s)

This section will help developper understand this project and how to set it up from the ground up and how to run it on their machine.

### Infrastructure

The current infrastructure of this project is as follow: 

* Azure Sandbox Subscription
    * Azure Function to transform the raw data (SSCPlus, etc.) to a Search Service index

* Service dependencie(s)
    * SSCPlus Data Fetch services (loads up raw data into blobs)
    * Azure OpenAI Services

#### Spinning up the infrastructure

Prerequisites:

* Azure Client, minimum of `Contributor` role in the subscription, then simply `az login`
* terraform

```bash
cd terraform/
terraform init
terraform plan
```

## Documentation

* [Azure Search Services](https://learn.microsoft.com/en-us/azure/search/search-get-started-portal)