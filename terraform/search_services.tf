resource "azurerm_search_service" "main" {
  name                = "${replace(var.project_name, "_", "-")}-search-service"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "standard"

  local_authentication_enabled = false
}