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
    always_on = false
    vnet_route_all_enabled = true
    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    "AzureWebJobsFeatureFlags"       = "EnableWorkerIndexing"
    "APPINSIGHTS_INSTRUMENTATIONKEY" = azurerm_application_insights.functions.instrumentation_key
    "BUILD_FLAGS"                    = "UseExpressBuild"
    "ENABLE_ORYX_BUILD"              = "true"
    "SCM_DO_BUILD_DURING_DEPLOYMENT" = "1"
    "XDG_CACHE_HOME"                 = "/tmp/.cache"
    "AZURE_SEARCH_SERVICE_ENDPOINT"  = ""
    "AZURE_SEARCH_INDEX_NAME"        = ""
    "AZURE_SEARCH_ADMIN_KEY"         = ""
    "BLOB_CONNECTION_STRING"         = ""
    "BLOB_CONTAINER_NAME"            = ""
  }

  identity {
    type = "SystemAssigned"
  }

}