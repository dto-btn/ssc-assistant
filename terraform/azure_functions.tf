/****************************************************
*                  Function App                     *
*****************************************************/
resource "azurerm_application_insights" "functions" {
  name                = "functions-app-insights"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  application_type    = "web"
}

resource "azurerm_service_plan" "functions" {
  name                = "functions-app-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}

resource "azurerm_linux_function_app" "functions" {
  name                = "index-mgmt"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  storage_account_name       = azurerm_storage_account.main.name
  storage_account_access_key = azurerm_storage_account.main.primary_access_key
  service_plan_id            = azurerm_service_plan.functions.id

  site_config {
    always_on = true
    vnet_route_all_enabled = true
    application_insights_key = azurerm_application_insights.functions.instrumentation_key
    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    "AzureWebJobsFeatureFlags"       = "EnableWorkerIndexing"
    "BUILD_FLAGS"                    = "UseExpressBuild"
    "ENABLE_ORYX_BUILD"              = "true"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "1"
    "XDG_CACHE_HOME"                 = "/tmp/.cache"
    "BLOB_CONNECTION_STRING"         = azurerm_storage_account.main.primary_connection_string
    "BLOB_CONTAINER_NAME"            = azurerm_storage_container.sscplus.name
    "DOMAIN_NAME"                    = "https://plus.ssc-spc.gc.ca"
    "AZURE_SEARCH_SERVICE_ENDPOINT"  = "https://${azurerm_search_service.main.name}.search.windows.net"
    "AZURE_OPENAI_ENDPOINT"          = data.azurerm_cognitive_account.ai.endpoint
    "AZURE_SEARCH_ADMIN_KEY"         = azurerm_search_service.main.primary_key
    "AZURE_OPENAI_API_KEY"           = data.azurerm_cognitive_account.ai.primary_access_key
  }

  identity {
    type = "SystemAssigned"
  }

  sticky_settings { # settings that are the same regardless of deployment slot..
    app_setting_names = [ "AZURE_SEARCH_SERVICE_ENDPOINT", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "DOMAIN_NAME", "AZURE_SEARCH_ADMIN_KEY", "BLOB_CONNECTION_STRING", "BLOB_CONTAINER_NAME", "FF_USE_NEW_SUGGESTION_SERVICE" ]
  }

  virtual_network_subnet_id = data.azurerm_subnet.subscription-vnet-sub.id
}

resource "azurerm_monitor_diagnostic_setting" "function_app_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-function-diag"
  target_resource_id         = azurerm_linux_function_app.functions.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "FunctionAppLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = false
  }
}