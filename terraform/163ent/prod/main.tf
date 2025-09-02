resource "azurerm_resource_group" "main" {
  name     = "TestRG-rg"
  location = var.default_location
}

module "openai" {
    source = "../modules/terraform-azurerm-cognitive-account"
    
    env               = "G3Pc"          # Must match pattern Upper-lower-Upper-lower per validation
    group             = "ECT"          # Alphanumeric only
    project           = "TestingTemplate"        # Alphanumeric only
    userDefinedString = "oai"     # Alphanumeric only

    # Resource group object (expected: name & location)
    resource_group = azurerm_resource_group.main

    # Cognitive account configuration
    cognitive_account = {
      sku_name = "S0"                 # Common SKU (e.g., F0, S0)
      kind     = "OpenAI"  # e.g., CognitiveServices, OpenAI
    }
}