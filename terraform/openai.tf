/****************************************************
*                     OpenAI                        *
*****************************************************/
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