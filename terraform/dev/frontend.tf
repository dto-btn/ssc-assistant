/****************************************************
*                 Azure App frontend                *
*****************************************************/
resource "azurerm_user_assigned_identity" "frontend" {
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  name                = "chatbot-frontend-identity"
}

resource "azurerm_user_assigned_identity" "frontend_auth" {
  count               = var.enable_auth ? 1 : 0
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  name                = "${replace(var.project_name, "_", "-")}-frontend-auth"
}

data "azuread_application" "frontend" {
  count     = var.enable_auth ? 1 : 0
  client_id = var.aad_client_id
}

resource "azuread_application_federated_identity_credential" "frontend_auth" {
  count          = var.enable_auth ? 1 : 0
  application_id = data.azuread_application.frontend[0].id
  display_name   = "${replace(var.project_name, "_", "-")}-frontend-auth"
  audiences      = ["api://AzureADTokenExchange"]
  issuer         = "https://login.microsoftonline.com/${azurerm_user_assigned_identity.frontend_auth[0].tenant_id}/v2.0"
  subject        = azurerm_user_assigned_identity.frontend_auth[0].principal_id
}

resource "azurerm_service_plan" "frontend" {
  name                = "${var.name_prefix}${var.project_name}-frontend-plan"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_resource_group.dev.location
  sku_name            = "S1"
  os_type             = "Linux"
}

resource "azurerm_linux_web_app" "frontend" {
  depends_on = [azuread_application_federated_identity_credential.frontend_auth]

  name                = replace(var.project_name, "_", "-")
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.frontend.location
  service_plan_id     = azurerm_service_plan.frontend.id

  virtual_network_subnet_id = azurerm_subnet.frontend.id

  client_affinity_enabled = false
  https_only              = true

  site_config {
    ftps_state = "FtpsOnly"

    application_stack {
      node_version = "22-lts"
    }
    use_32_bit_worker = false

    app_command_line = "NODE_ENV=production node server.js"

    cors {
      allowed_origins     = ["https://assistant-dev.cio-sandbox-ect.ssc-spc.cloud-nuage.canada.ca"]
      support_credentials = true
    }
  }

  app_settings = merge({
    VITE_API_BACKEND                 = "https://${replace(var.project_name, "_", "-")}-api.azurewebsites.net/"
    VITE_API_KEY                     = var.vite_api_key
    VITE_SAS_TOKEN                   = data.azurerm_storage_account_sas.blob_read_sas.sas
    VITE_BLOB_STORAGE_URL            = azurerm_storage_account.dev.primary_blob_endpoint
    WEBSITE_RUN_FROM_PACKAGE         = "1"
    PORT                             = 8080
    WEBSITE_AUTH_AAD_ALLOWED_TENANTS = data.azurerm_client_config.current.tenant_id
    NODE_OPTIONS                     = "--max-http-header-size=32768"
    }, var.enable_auth ? {
    OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID = azurerm_user_assigned_identity.frontend_auth[0].client_id
  } : {})

  dynamic "sticky_settings" {
    for_each = var.enable_auth ? [true] : []
    content {
      app_setting_names = ["OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"]
    }
  }

  identity {
    type = "UserAssigned"
    identity_ids = concat(
      [azurerm_user_assigned_identity.frontend.id],
      azurerm_user_assigned_identity.frontend_auth[*].id,
    )
  }

  dynamic "auth_settings_v2" {
    for_each = var.enable_auth ? [""] : []
    content {
      auth_enabled           = true
      default_provider       = "azureactivedirectory"
      require_authentication = true

      active_directory_v2 {
        client_id                  = var.aad_client_id
        client_secret_setting_name = "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"
        tenant_auth_endpoint       = var.aad_auth_endpoint
        allowed_audiences          = ["api://${var.aad_client_id}"]
        allowed_applications       = [var.aad_client_id]
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
  name                = "ScSc-CIO_ECT_ssc_assistant_dev-rg-CanadaCentralwebspace-Linux-260306201355"
  resource_group_name = azurerm_resource_group.dev.name
  location            = azurerm_service_plan.frontend.location
  # Cert in keyvault
  pfx_blob = filebase64("../certificates/certificate2026-pilot-prod.pfx")
  password = var.pfx_secret

  # var.pfx_secret only needed on new deployment or recreate.  Use random value otherwise.
  lifecycle {
    ignore_changes = [
      password,
      pfx_blob,
    ]
  }
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