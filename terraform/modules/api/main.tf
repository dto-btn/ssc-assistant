/****************************************************
*                 Azure App API                *
*****************************************************/
resource "azurerm_service_plan" "api" {
  name                = "${var.name_prefix}${var.project_name}-api-plan"
  resource_group_name = var.rg_name
  location            = var.default_location
  sku_name            = "S1"
  os_type             = "Linux"
}

resource "azurerm_monitor_metric_alert" "http_5xx_alert" {
  name                = "SSC Assistant 5xx Alert"
  resource_group_name = var.rg_name
  scopes              = [azurerm_linux_web_app.api.id]
  description         = "Alert for HTTP 5xx Errors"
  severity            = 1
  frequency           = "PT1M"
  window_size         = "PT5M"
  target_resource_type = "Microsoft.Web/sites"
  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 1
  }
}

resource "azurerm_monitor_metric_alert" "http_4xx_alert" {
  name                = "SSC Assistant 4xx Alert"
  resource_group_name = var.rg_name
  scopes              = [azurerm_linux_web_app.api.id]
  description         = "Alert for HTTP 4xx Errors"
  severity            = 2
  frequency           = "PT1M"
  window_size         = "PT5M"
  target_resource_type = "Microsoft.Web/sites"
  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http4xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 10
  }
}


resource "azurerm_monitor_action_group" "alerts_group" {
  name                = "SSC Assistant Alerts group"
  resource_group_name = var.rg_name
  short_name          = "Alert"

  dynamic "email_receiver" {
    for_each = var.users
    content {
      name          = email_receiver.value.name
      email_address = email_receiver.value.user_principal_name
    }
  }
}

resource "azurerm_linux_web_app" "api" {
  name                = "${replace(var.project_name, "_", "-")}-api"
  resource_group_name = var.rg_name
  location            = azurerm_service_plan.api.location
  service_plan_id     = azurerm_service_plan.api.id

  virtual_network_subnet_id = var.subnet_id

  client_affinity_enabled = true
  https_only = true

  site_config {
    ftps_state = "FtpsOnly"
    api_definition_url = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net/openapi.json"

    application_stack {
      python_version = "3.12"
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
    AZURE_SEARCH_SERVICE_ENDPOINT = "https://${var.search_service_name}.search.windows.net"
    AZURE_SEARCH_ADMIN_KEY        = var.search_service_pk
    AZURE_OPENAI_ENDPOINT         = var.ai_endpoint
    AZURE_OPENAI_API_KEY          = var.ai_key
    AZURE_OPENAI_MODEL            = "gpt-4o"
    AZURE_SEARCH_INDEX_NAME       = "current"
    GEDS_API_TOKEN                = var.geds_api_token
    SERVER_URL_PROD               = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net"
    JWT_SECRET                    = var.jwt_secret
    DATABASE_ENDPOINT             = var.table_endpoint
    BLOB_ENDPOINT                 = var.blob_endpoint
    AZURE_AD_CLIENT_ID            = var.aad_client_id_api
    AZURE_AD_TENANT_ID            = var.tenant_id
    ARCHIBUS_API_USERNAME         = var.archibus_api_user
    ARCHIBUS_API_PASSWORD         = var.archibus_api_password
    WEBSITE_WEBDEPLOY_USE_SCM     = true
    WEBSITE_RUN_FROM_PACKAGE      = "1"
    ALLOWED_TOOLS                 = join(", ", var.allowed_tools)
    WEBSITE_AUTH_AAD_ALLOWED_TENANTS = var.tenant_id
    #PORT = 5001
  }

  sticky_settings { # settings that are the same regardless of deployment slot..
    app_setting_names = [ "AZURE_SEARCH_SERVICE_ENDPOINT", "AZURE_SEARCH_ADMIN_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "DATABASE_ENDPOINT", "BLOB_ENDPOINT", "AZURE_SEARCH_INDEX_NAME", "ALLOWED_TOOLS", "ARCHIBUS_API_USERNAME", "ARCHIBUS_API_PASSWORD"]
  }
}

resource "azurerm_monitor_diagnostic_setting" "api_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-api-diag"
  target_resource_id         = azurerm_linux_web_app.api.id
  log_analytics_workspace_id = var.log_analytics_workspace_id

  enabled_log {
    category = "AppServiceConsoleLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true 
  }
}