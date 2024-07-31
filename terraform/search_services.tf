resource "azurerm_search_service" "main" {
  name                = "${replace(var.project_name, "_", "-")}-search-service"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "standard"

  tags = {
    ProjectType = "aoai-your-data-service"
  }

  public_network_access_enabled = true
  local_authentication_enabled = true
  authentication_failure_mode = "http401WithBearerChallenge"
}

resource "azurerm_monitor_diagnostic_setting" "search_service_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-search-diag"
  target_resource_id         = azurerm_search_service.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "OperationLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = false
  }
}