/****************************************************
*                 Azure App frontend                *
*****************************************************/
resource "azurerm_service_plan" "api" {
  name                = "${var.name_prefix}${var.project_name}-api-plan"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku_name            = "S1"
  os_type             = "Linux"
}

resource "azurerm_linux_web_app" "api" {
  name                = "${replace(var.project_name, "_", "-")}-api"
  resource_group_name = azurerm_resource_group.main.name
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
    AZURE_SEARCH_SERVICE_ENDPOINT = "https://${azurerm_search_service.main.name}.search.windows.net"
    AZURE_SEARCH_ADMIN_KEY        = azurerm_search_service.main.primary_key
    AZURE_OPENAI_ENDPOINT         = data.azurerm_cognitive_account.ai.endpoint
    AZURE_OPENAI_API_KEY          = data.azurerm_cognitive_account.ai.primary_access_key
    AZURE_OPENAI_MODEL            = "gpt-4o"
    AZURE_SEARCH_INDEX_NAME       = "current"
    GEDS_API_TOKEN                = var.geds_api_token
    SERVER_URL_PROD               = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net"
    JWT_SECRET                    = var.jwt_secret
    DATABASE_ENDPOINT             = azurerm_storage_account.main.primary_table_endpoint
    AZURE_AD_CLIENT_ID            = var.aad_client_id
    AZURE_AD_TENANT_ID            = data.azurerm_client_config.current.tenant_id
    WEBSITE_WEBDEPLOY_USE_SCM     = true
    WEBSITE_RUN_FROM_PACKAGE      = "1"
    #PORT = 5001
  }

  sticky_settings { # settings that are the same regardless of deployment slot..
    app_setting_names = [ "AZURE_SEARCH_SERVICE_ENDPOINT", "AZURE_SEARCH_ADMIN_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY", "DATABASE_ENDPOINT", "AZURE_SEARCH_INDEX_NAME" ]
  }
}

resource "azurerm_monitor_diagnostic_setting" "api_diagnostics" {
  name                       = "${replace(var.project_name, "_", "-")}-api-diag"
  target_resource_id         = azurerm_linux_web_app.api.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "AppServiceConsoleLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true 
  }
}