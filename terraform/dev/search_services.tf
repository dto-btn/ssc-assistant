resource "azurerm_search_service" "main" {
  name                = "${replace(var.project_name, "_", "-")}-search-service"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  sku                 = "standard"

  tags = {
    ProjectType = "aoai-your-data-service"
  }

  public_network_access_enabled = true
  local_authentication_enabled = true
  authentication_failure_mode = "http401WithBearerChallenge"
}