# SSC Assistant
Second iteration of the SSC chatbot/assistant.

## Developper(s)

This section will help developper understand this project and how to set it up from the ground up and how to run it on their machine.

### Python setup

We are developping on python 3.11+. 

Please setup your environement like so:

We have 2 python projects in this repo, I create 2 virtual envs and switch between them via command line and/or visual studio.

First we setup the backend API project:

```bash
python3 -m venv .venv_api
source .venv_api/bin/activate
pip install -r app/api/requirements.txt --upgrade
```

You should then see something like this denoting which environement you are in your shell. To leave this `.venv` simply type `deactivate`

```bash
(.venv_api) ➜  ~/git/ssc-assistant/
```

**Now ensure that VSCode** uses the proper `.venv` folder by pressing `Ctrl + Shift + P` and then type `Python: Select Interpreter`

and then the azure function project:

```bash
python3 -m venv .venv_func
source .venv_func/bin/activate
pip install -r az-functions/create-index/requirements.txt --upgrade
```

(for this virtual env the `.vscode/settings.json` should already be pointing to the proper folder, else re-follow steps above to ensure VSCode uses the proper venv for that section of the project)

#### Starting up projects

For the `app/frontend` simply: 

```bash
npm install
npm run dev
```

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
terraform plan -var-file="secret.tfvars"
```

## Documentation

* [Azure Search Services](https://learn.microsoft.com/en-us/azure/search/search-get-started-portal)
* [Use your data](https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/use-your-data?tabs=ai-search)