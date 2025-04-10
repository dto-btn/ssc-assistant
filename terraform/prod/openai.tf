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


# TEMPORARY REMOVE WHEN THE CODE SUPPORTS THE NEW 2024-11-20 deployed model version
data "azurerm_resource_group" "ai-pilot-prod" {
  provider = azurerm.pilot-prod
  name = "ScSc-CIO-ECT-OpenAI-rg"
}

data "azurerm_cognitive_account" "ai-pilot-prod" {
  provider = azurerm.pilot-prod
  name                = "ScSc-CIO-ECT-OpenAI-oai"
  resource_group_name = "ScSc-CIO-ECT-OpenAI-rg"
}

resource "azurerm_role_assignment" "api_read_openai-old-prod" {
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai-pilot-prod.id
  principal_id = module.api.api_principal_id
}