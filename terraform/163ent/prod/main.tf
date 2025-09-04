resource "azurerm_resource_group" "main" {
  name     = "TestRG-rg"
  location = var.default_location
}

module "openai" {
  source = "../modules/terraform-azurerm-cognitive-account"
  
  env               = "G3Pc"          # Must match pattern Upper-lower-Upper-lower per validation
  group             = "ECT"          # Alphanumeric only
  project           = "account"        # Alphanumeric only
  userDefinedString = "oai"     # Alphanumeric only

  # Resource group object (expected: name & location)
  resource_group = azurerm_resource_group.main

  # Cognitive account configuration
  cognitive_account = {
    sku_name = "S0"                 # Common SKU (e.g., F0, S0)
    kind     = "OpenAI"  # e.g., CognitiveServices, OpenAI
  }
}

module "deployments" {
  source = "../modules/terraform-azurerm-cognitive-deployment"
  # Cognitive account configuration
  cognitive_deployments = {
    "gpt4o" = {
      cognitive_account_id = module.openai.id
      model = {
        format  = "OpenAI"
        name    = "gpt-4o"
        version = "2024-05-13"
      }
      sku = {
        name     = "GlobalStandard"
        capacity = 3000 #TPM/K
      }
    }
  }
}