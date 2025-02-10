/****************************************************
*                 Azure App frontend                *
*****************************************************/
resource "azurerm_user_assigned_identity" "frontend" {
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  name                = "chatbot-frontend-identity"
}

resource "azurerm_service_plan" "frontend" {
  name                = "${var.name_prefix}${var.project_name}-frontend-plan"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  sku_name            = "S1"
  os_type             = "Linux"
}

resource "azurerm_linux_web_app" "frontend" {
  name                = "${replace(var.project_name, "_", "-")}"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.frontend.location
  service_plan_id     = azurerm_service_plan.frontend.id

  virtual_network_subnet_id = azurerm_subnet.frontend.id

  client_affinity_enabled = true
  https_only = true

  site_config {
    ftps_state = "FtpsOnly"

    application_stack {
      node_version = "20-lts"
    }
    use_32_bit_worker = false

    app_command_line = "NODE_ENV=production node server.js"

    cors {
      allowed_origins     = ["https://assistant-dev.cio-sandbox-ect.ssc-spc.cloud-nuage.canada.ca"]
      support_credentials = true
    }
  }

  app_settings = {
    VITE_API_BACKEND         = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net/"
    VITE_API_KEY             = var.vite_api_key
    VITE_SAS_TOKEN           = data.azurerm_storage_account_sas.blob_read_sas.sas
    VITE_BLOB_STORAGE_URL    = azurerm_storage_account.dev.primary_blob_endpoint
    WEBSITE_RUN_FROM_PACKAGE = "1"
    MICROSOFT_PROVIDER_AUTHENTICATION_SECRET = var.microsoft_provider_authentication_secret
    PORT = 8080
    WEBSITE_AUTH_AAD_ALLOWED_TENANTS = data.azurerm_client_config.current.tenant_id
  }

  sticky_settings {
    app_setting_names = [ "VITE_API_BACKEND", "VITE_API_KEY", "WEBSITE_RUN_FROM_PACKAGE",
    "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET", "PORT", "VITE_SAS_TOKEN", "VITE_BLOB_STORAGE_URL"]
  }

  identity {
    type = "UserAssigned"
    identity_ids = [ azurerm_user_assigned_identity.frontend.id ]
  }

  dynamic "auth_settings_v2" {
    for_each = var.enable_auth == true ? [""] : []
    content {
      auth_enabled = true
      default_provider = "azureactivedirectory"
      require_authentication = true

      active_directory_v2 {
        client_id = var.aad_client_id
        client_secret_setting_name = "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET"
        tenant_auth_endpoint = var.aad_auth_endpoint
        allowed_audiences = ["api://${var.aad_client_id}"]
        allowed_applications = [var.aad_client_id]
      }

      # apple_v2 {
      #   login_scopes = []
      # }

      # facebook_v2 {
      #   login_scopes = []
      # }

      # github_v2 {
      #   login_scopes = []
      # }

      # google_v2 {
      #   allowed_audiences = []
      #   login_scopes      = []
      # }

      login {
        token_store_enabled = true
      }
    }
  }
}

resource "azurerm_app_service_certificate" "frontend" {
  name                = "ssc-assistant-cert"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.frontend.location
  pfx_blob            = filebase64("../certificates/ssc-assistant-sandbox.pfx")
  password            = var.pfx_secret
}

resource "azurerm_app_service_custom_hostname_binding" "frontend" {
  hostname            = "assistant-dev.cio-sandbox-ect.ssc-spc.cloud-nuage.canada.ca"
  app_service_name    = azurerm_linux_web_app.frontend.name
  resource_group_name = azurerm_resource_group.dev.name
}

resource "azurerm_app_service_certificate_binding" "frontend" {
  hostname_binding_id = azurerm_app_service_custom_hostname_binding.frontend.id
  certificate_id      = azurerm_app_service_certificate.frontend.id
  ssl_state           = "SniEnabled"
}