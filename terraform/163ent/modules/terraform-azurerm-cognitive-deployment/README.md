# Azure Cognitive Deployment Terraform Module

This Terraform module creates multiple Azure Cognitive Services deployments using a `for_each` loop, typically used for deploying AI models like GPT-4, GPT-3.5-Turbo, or other OpenAI models to an Azure Cognitive Services account.

## Features

- Creates multiple Azure Cognitive Services deployments with configurable SKU and model settings
- Uses `for_each` to manage multiple deployments efficiently
- Follows Canada.ca naming conventions
- Supports optional Responsible AI (RAI) policies
- Configurable version upgrade options
- Comprehensive validation for naming variables

## Usage

```hcl
module "cognitive_deployments" {
  source = "./modules/terraform-azurerm-cognitive-deployment"
  
  # Naming variables
  env               = "G3Dc"
  group             = "ABC"
  project           = "Portal"
  userDefinedString = "AI"
  
  # Resource group
  resource_group = {
    name     = "rg-ai-services-dev"
    location = "canadacentral"
  }
  
  # Multiple deployment configurations
  cognitive_deployments = {
    "gpt4o" = {
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
    
    "gpt35turbo" = {
      cognitive_account_id = "/subscriptions/.../providers/Microsoft.CognitiveServices/accounts/my-openai-account"
      
      model = {
        format  = "OpenAI"
        name    = "gpt-35-turbo"
        version = "0613"
      }
      
      sku = {
        name     = "Standard"
        capacity = 30
      }
    }
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
| cognitive_deployments | Map of cognitive deployment configurations. The key will be used as part of the deployment name | `map(object({...}))` | n/a | yes |
| env | Deployment environment code (e.g., dev, test, prod) | `string` | n/a | yes |
| group | Business or organizational group identifier | `string` | n/a | yes |
| project | Short project identifier | `string` | n/a | yes |
| resource_group | Resource group object containing name and location | `any` | n/a | yes |
| tags | Tags to be applied to resources that support them (Note: azurerm_cognitive_deployment does not support tags) | `map(string)` | `{}` | no |
| userDefinedString | Free-form suffix/purpose string included in resource names | `string` | n/a | yes |

## Outputs

| Name | Description |
|------|-------------|
| deployments | Map of all cognitive deployments with their details |
| deployment_ids | Map of deployment keys to their IDs |
| deployment_names | Map of deployment keys to their names |

## Regional Deployment Options

Azure Cognitive Deployments do **not** have a direct `location` parameter. Instead, region behavior is controlled through:

### 1. **Deployment Types (via SKU name)**

| SKU Name | Region Behavior | Use Case |
|----------|----------------|----------|
| `Standard` | Same region as Cognitive Account | Data residency, predictable latency |
| `GlobalStandard` | Global routing across Azure regions | High availability, global distribution |
| `ProvisionedManaged` | Same region as Cognitive Account | Guaranteed performance, reserved capacity |
| `GlobalProvisionedManaged` | Global routing with reserved capacity | Enterprise-grade global deployments |

### 2. **Multi-Region Strategy**

To deploy models in different regions, use **multiple Cognitive Accounts**:

```hcl
# Account in Canada Central
resource "azurerm_cognitive_account" "canada" {
  location = "canadacentral"
  # ... other config
}

# Account in East US 2
resource "azurerm_cognitive_account" "eastus" {
  location = "eastus2" 
  # ... other config
}

# Deploy to different regions
cognitive_deployments = {
  "gpt4o-canada" = {
    cognitive_account_id = azurerm_cognitive_account.canada.id
    sku = { name = "Standard" }  # Regional in Canada Central
    # ... model config
  }
  
  "gpt4o-us" = {
    cognitive_account_id = azurerm_cognitive_account.eastus.id  
    sku = { name = "Standard" }  # Regional in East US 2
    # ... model config
  }
  
  "gpt4o-global" = {
    cognitive_account_id = azurerm_cognitive_account.canada.id
    sku = { name = "GlobalStandard" }  # Global routing
    # ... model config  
  }
}
```

### 3. **Regional Availability Considerations**

- **Model availability varies by region** - check [Azure OpenAI model availability](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models) 
- **Global Standard** models are available in more regions than Standard
- **Data residency** requirements may mandate Standard (regional) deployments

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
`{env}-{group}-{project}-{userDefinedString}-{deployment_key}-cdep`

Where:
- `env`: 4-character environment code (Upper-lower-Upper-lower pattern)
- `group`: Business/organizational group identifier (alphanumeric)
- `project`: Short project identifier (alphanumeric)
- `userDefinedString`: Purpose/suffix string (alphanumeric)
- `deployment_key`: The key from the `cognitive_deployments` map
- `cdep`: Resource type suffix for Cognitive Deployment

Example: `G3Dc-ABC-Portal-AI-gpt4o-cdep`

## Accessing Outputs

```hcl
# Get a specific deployment ID
output "gpt4o_deployment_id" {
  value = module.cognitive_deployments.deployment_ids["gpt4o"]
}

# Get all deployment details
output "all_deployments" {
  value = module.cognitive_deployments.deployments
}
```

## Notes

- The `cognitive_account_id` must reference an existing Azure Cognitive Services account
- Model availability varies by region and account type
- SKU capacity represents token limits (TPM - Tokens Per Minute in thousands)
- Version upgrade options control automatic model version updates
