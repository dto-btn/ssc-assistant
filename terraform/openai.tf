/****************************************************
*                     OpenAI                        *
*****************************************************/
data "azurerm_resource_group" "ai" {
  name = var.openai_rg
}

data "azurerm_cognitive_account" "ai" {
  name                = var.openai_name
  resource_group_name = var.openai_rg
  //kind = "OpenAI"
}

resource "azurerm_monitor_diagnostic_setting" "openai_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-openai-diag"
  target_resource_id         = data.azurerm_cognitive_account.ai.id
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
  scope = data.azurerm_resource_group.ai.id
  principal_id = azurerm_linux_web_app.api.identity[0].principal_id
}