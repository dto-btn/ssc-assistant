/****************************************************
*                 Azure App Dev API                *
*****************************************************/
resource "azurerm_service_plan" "api" {
  name                = "${var.name_prefix}${var.project_name}-api-plan"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  sku_name            = "S1"
  os_type             = "Linux"
}
resource "azurerm_monitor_metric_alert" "http_alert" {
  name                = "${replace(var.project_name, "_", "-")}-api-alert"
  resource_group_name = azurerm_resource_group.dev.name
  scopes              = [var.scope]
  description         = "Alert for HTTP Error"
  severity            = 3
  frequency           = "PT1M"
  window_size         = "PT5M"
  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 1
  }

  action {
    action_group_id =  var.action_group_id
  }
}
resource "azurerm_monitor_action_group" "alerts_group" {
  name                = "Alerts group"
  resource_group_name = azurerm_resource_group.dev.name
  short_name          = "Alert"
  
  email_receiver {
    name                    = "Harsha"
    email_address           = "harsha.kakumanu@ssc-spc.gc.ca"
  }
  email_receiver {
    name                    = "Guillaume"
    email_address           = "guillaume.turcotte2@ssc-spc.gc.ca"
  }

}
resource "azurerm_linux_web_app" "api" {
  name                = "${replace(var.project_name, "_", "-")}-api"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.api.location
  service_plan_id     = azurerm_service_plan.api.id

  virtual_network_subnet_id = azurerm_subnet.api.id

  client_affinity_enabled = true
  https_only = true

  site_config {
    ftps_state = "FtpsOnly"
    api_definition_url = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net/openapi.json"

    application_stack {
      python_version = "3.11"
    }
    use_32_bit_worker = false

    #app_command_line = "gunicorn --bind=0.0.0.0 app:app"
  }

  logs {
    detailed_error_messages = false
    failed_request_tracing  = false
    http_logs {
        file_system {
            retention_in_days = 30
            retention_in_mb   = 35
          }
      }
  }

  identity {
    type = "SystemAssigned"
  }

  app_settings = {
    AZURE_SEARCH_SERVICE_ENDPOINT = "https://${data.azurerm_search_service.main.name}.search.windows.net"
    AZURE_SEARCH_ADMIN_KEY        = data.azurerm_search_service.main.primary_key
    AZURE_OPENAI_ENDPOINT         = data.azurerm_cognitive_account.ai.endpoint
    AZURE_OPENAI_API_KEY          = data.azurerm_cognitive_account.ai.primary_access_key
    AZURE_OPENAI_MODEL            = "gpt-4o"
    AZURE_SEARCH_INDEX_NAME       = "current"
    GEDS_API_TOKEN                = var.geds_api_token
    SERVER_URL_PROD               = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net"
    JWT_SECRET                    = var.jwt_secret
    DATABASE_ENDPOINT             = azurerm_storage_account.dev.primary_table_endpoint
    AZURE_AD_CLIENT_ID            = var.aad_client_id
    AZURE_AD_TENANT_ID            = data.azurerm_client_config.current.tenant_id
    ARCHIBUS_API_USERNAME         = var.archibus_api_user
    ARCHIBUS_API_PASSWORD         = var.archibus_api_password
    WEBSITE_WEBDEPLOY_USE_SCM     = true
    WEBSITE_RUN_FROM_PACKAGE      = "1"
    #PORT = 5001
  }

  sticky_settings { # settings that are the same regardless of deployment slot..
    app_setting_names = [ "AZURE_SEARCH_SERVICE_ENDPOINT", "AZURE_SEARCH_ADMIN_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "DATABASE_ENDPOINT", "AZURE_SEARCH_INDEX_NAME" ]
  }
}
