/****************************************************
*                     OpenAI                        *
*****************************************************/
resource "azurerm_resource_group" "ai" {
  name     = var.openai_rg
  location = var.default_location
}

resource "azurerm_cognitive_account" "ai" {
  name                = var.openai_name
  resource_group_name = var.openai_rg
  location            = var.default_location
  kind                = "OpenAI"
  sku_name            = "S0"
}

resource "azurerm_monitor_diagnostic_setting" "openai_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-openai-diag"
  target_resource_id         = azurerm_cognitive_account.ai.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category_group = "allLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}

resource "azurerm_role_assignment" "api_read_openai" {
  role_definition_name = "Cognitive Services User"
  scope = azurerm_resource_group.ai.id
  principal_id = module.api.api_principal_id
}