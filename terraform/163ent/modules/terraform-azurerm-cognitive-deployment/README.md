# Azure Cognitive Deployment Terraform Module

This Terraform module creates an Azure Cognitive Services deployment, typically used for deploying AI models like GPT-4, GPT-3.5-Turbo, or other OpenAI models to an Azure Cognitive Services account.

## Features

- Creates Azure Cognitive Services deployments with configurable SKU and model settings
- Follows Canada.ca naming conventions
- Supports optional Responsible AI (RAI) policies
- Configurable version upgrade options
- Comprehensive validation for naming variables

## Usage

```hcl
module "cognitive_deployment" {
  source = "./modules/terraform-azurerm-cognitive-deployment"
  
  # Naming variables
  env               = "G3Dc"
  group             = "ABC"
  project           = "Portal"
  userDefinedString = "GPT4o"
  
  # Resource group
  resource_group = {
    name     = "rg-ai-services-dev"
    location = "canadacentral"
  }
  
  # Deployment configuration
  cognitive_deployment = {
    cognitive_account_id = "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/my-openai-account"
    
    model = {
      format  = "OpenAI"
      name    = "gpt-4o"
      version = "2024-05-13"
    }
    
    sku = {
      name     = "Standard"
      capacity = 10
    }
  }
  
  tags = {
    Environment = "dev"
    Project     = "Portal"
  }
}
```

## Examples

See the `ESLZ/cognitiveDeployment.tfvars` file for a complete example configuration.

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.0 |
| azurerm | >= 3.0 |

## Providers

| Name | Version |
|------|---------|
| azurerm | >= 3.0 |

## Resources

| Name | Type |
|------|------|
| [azurerm_cognitive_deployment.cognitive-deployment](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/cognitive_deployment) | resource |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| cognitive_deployment | Cognitive deployment configuration object | `object({...})` | n/a | yes |
| env | Deployment environment code (e.g., dev, test, prod) | `string` | n/a | yes |
| group | Business or organizational group identifier | `string` | n/a | yes |
| project | Short project identifier | `string` | n/a | yes |
| resource_group | Resource group object containing name and location | `any` | n/a | yes |
| tags | Tags to be applied to the cognitive deployment | `map(string)` | `{}` | no |
| userDefinedString | Free-form suffix/purpose string included in resource names | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| cognitive_account_id | The Cognitive Account ID associated with this deployment |
| id | The ID of the Cognitive Deployment |
| model | The model configuration for this deployment |
| name | The name of the Cognitive Deployment |
| sku | The SKU configuration for this deployment |

## Common Model Configurations

### GPT-4o
```hcl
model = {
  format  = "OpenAI"
  name    = "gpt-4o"
  version = "2024-05-13"
}
```

### GPT-3.5-Turbo
```hcl
model = {
  format  = "OpenAI"
  name    = "gpt-35-turbo"
  version = "0613"
}
```

### Text Embedding Ada 002
```hcl
model = {
  format  = "OpenAI"
  name    = "text-embedding-ada-002"
  version = "2"
}
```

## Naming Convention

The module follows the Canada.ca naming convention:
`{env}-{group}-{project}-{userDefinedString}-cdep`

Where:
- `env`: 4-character environment code (Upper-lower-Upper-lower pattern)
- `group`: Business/organizational group identifier (alphanumeric)
- `project`: Short project identifier (alphanumeric)
- `userDefinedString`: Purpose/suffix string (alphanumeric)
- `cdep`: Resource type suffix for Cognitive Deployment

## Notes

- The `cognitive_account_id` must reference an existing Azure Cognitive Services account
- Model availability varies by region and account type
- SKU capacity represents token limits (TPM - Tokens Per Minute in thousands)
- Version upgrade options control automatic model version updates
