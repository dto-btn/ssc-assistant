resource "azurerm_resource_group" "main" {
  name     = "TestRG-rg"
  location = var.default_location
}

module "openai" {
    source = "../modules/terraform-azurerm-cognitive-account"
    
    name     = "testcogacc1234"
    rg_name  = azurerm_resource_group.main.name
    location = azurerm_resource_group.main.location
}