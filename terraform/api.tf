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

  app_settings = {
    AZURE_SEARCH_SERVICE_ENDPOINT = "https://${azurerm_search_service.main.name}.search.windows.net"
    AZURE_SEARCH_ADMIN_KEY        = azurerm_search_service.main.primary_key
    AZURE_OPENAI_ENDPOINT         = data.azurerm_cognitive_account.ai.endpoint
    AZURE_OPENAI_API_KEY          = data.azurerm_cognitive_account.ai.primary_access_key
    #PORT = 5001
  }

  sticky_settings {
    app_setting_names = [ "AZURE_SEARCH_SERVICE_ENDPOINT", "AZURE_SEARCH_ADMIN_KEY", "AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_API_KEY" ]
  }
}