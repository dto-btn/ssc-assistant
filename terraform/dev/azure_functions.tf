/****************************************************
*                  Function App                     *
*****************************************************/
resource "azurerm_application_insights" "functions" {
  name                = "functions-app-insights"
  location            = azurerm_resource_group.dev.location
  resource_group_name = azurerm_resource_group.dev.name
  application_type    = "web"
}

resource "azurerm_service_plan" "functions" {
  name                = "functions-app-plan"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  os_type             = "Linux"
  sku_name            = "P1v3"
}

resource "azurerm_linux_function_app" "functions" {
  name                = "dev-index-mgmt"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location

  storage_account_name       = azurerm_storage_account.dev.name
  storage_account_access_key = azurerm_storage_account.dev.primary_access_key
  service_plan_id            = azurerm_service_plan.functions.id

  site_config {
    always_on = false
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
    "AZURE_SEARCH_SERVICE_ENDPOINT"  = ""
    "AZURE_SEARCH_INDEX_NAME"        = ""
    "AZURE_SEARCH_ADMIN_KEY"         = ""
    "BLOB_CONNECTION_STRING"         = azurerm_storage_account.dev.primary_connection_string
    "BLOB_CONTAINER_NAME"            = ""
  }

  virtual_network_subnet_id = data.azurerm_subnet.subscription-vnet-sub.id

  identity {
    type = "SystemAssigned"
  }

}