mock_provider "azurerm" {
  override_during = plan

  mock_resource "azurerm_user_assigned_identity" {
    defaults = {
      id           = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.ManagedIdentity/userAssignedIdentities/auth"
      client_id    = "00000000-0000-0000-0000-000000000002"
      principal_id = "00000000-0000-0000-0000-000000000003"
      tenant_id    = "00000000-0000-0000-0000-000000000004"
    }
  }

  mock_resource "azurerm_service_plan" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.Web/serverFarms/frontend"
    }
  }

  mock_resource "azurerm_subnet" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.Network/virtualNetworks/test/subnets/frontend"
    }
  }

  mock_resource "azurerm_virtual_network" {
    defaults = {
      id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.Network/virtualNetworks/test"
    }
  }

  mock_data "azurerm_client_config" {
    defaults = {
      tenant_id = "00000000-0000-0000-0000-000000000004"
    }
  }
}

mock_provider "azuread" {
  override_during = plan

  mock_data "azuread_application" {
    defaults = {
      id = "/applications/00000000-0000-0000-0000-000000000005"
    }
  }
}

override_resource {
  override_during = plan
  target          = azurerm_user_assigned_identity.frontend
  values = {
    id = "/subscriptions/00000000-0000-0000-0000-000000000001/resourceGroups/test/providers/Microsoft.ManagedIdentity/userAssignedIdentities/existing"
  }
}

variables {
  jwt_secret     = "test-only"
  pfx_secret     = "test-only"
  vite_api_key   = "test-only"
  geds_api_token = "test-only"
  aad_client_id  = "00000000-0000-0000-0000-000000000005"
}

run "auth_enabled" {
  command = plan

  plan_options {
    target = [azurerm_linux_web_app.frontend]
  }

  variables {
    enable_auth = true
  }

  assert {
    condition = (
      azuread_application_federated_identity_credential.frontend_auth[0].application_id == data.azuread_application.frontend[0].id &&
      azuread_application_federated_identity_credential.frontend_auth[0].subject == azurerm_user_assigned_identity.frontend_auth[0].principal_id &&
      azuread_application_federated_identity_credential.frontend_auth[0].issuer == "https://login.microsoftonline.com/00000000-0000-0000-0000-000000000004/v2.0" &&
      one(azuread_application_federated_identity_credential.frontend_auth[0].audiences) == "api://AzureADTokenExchange"
    )
    error_message = "Federation must trust the identity principal in its tenant with the token-exchange audience."
  }

  assert {
    condition     = azurerm_linux_web_app.frontend.app_settings["OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"] == azurerm_user_assigned_identity.frontend_auth[0].client_id
    error_message = "Easy Auth must use the managed identity client ID, not the application client ID."
  }

  assert {
    condition     = azurerm_linux_web_app.frontend.auth_settings_v2[0].active_directory_v2[0].client_secret_setting_name == "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID"
    error_message = "Easy Auth must reference the identity assertion setting."
  }

  assert {
    condition     = contains(azurerm_linux_web_app.frontend.sticky_settings[0].app_setting_names, "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID")
    error_message = "The identity assertion setting must be slot-sticky."
  }

  assert {
    condition = (
      length(azurerm_linux_web_app.frontend.identity[0].identity_ids) == 2 &&
      contains(azurerm_linux_web_app.frontend.identity[0].identity_ids, azurerm_user_assigned_identity.frontend.id) &&
      contains(azurerm_linux_web_app.frontend.identity[0].identity_ids, azurerm_user_assigned_identity.frontend_auth[0].id)
    )
    error_message = "The existing identity and the dedicated authentication identity must both remain attached."
  }

  assert {
    condition     = !contains(keys(azurerm_linux_web_app.frontend.app_settings), "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET")
    error_message = "The frontend must no longer store an authentication client secret."
  }
}

run "auth_disabled" {
  command = plan

  plan_options {
    target = [azurerm_linux_web_app.frontend]
  }

  variables {
    enable_auth = false
  }

  assert {
    condition     = length(azurerm_user_assigned_identity.frontend_auth) == 0 && length(azuread_application_federated_identity_credential.frontend_auth) == 0
    error_message = "Disabled authentication must not create identity federation resources."
  }

  assert {
    condition     = length(azurerm_linux_web_app.frontend.auth_settings_v2) == 0 && length(azurerm_linux_web_app.frontend.sticky_settings) == 0
    error_message = "Disabled authentication must not configure Easy Auth or an identity slot setting."
  }

  assert {
    condition = (
      !contains(keys(azurerm_linux_web_app.frontend.app_settings), "OVERRIDE_USE_MI_FIC_ASSERTION_CLIENTID") &&
      !contains(keys(azurerm_linux_web_app.frontend.app_settings), "MICROSOFT_PROVIDER_AUTHENTICATION_SECRET") &&
      length(azurerm_linux_web_app.frontend.identity[0].identity_ids) == 1 &&
      contains(azurerm_linux_web_app.frontend.identity[0].identity_ids, azurerm_user_assigned_identity.frontend.id)
    )
    error_message = "Disabled authentication must preserve only the existing identity and omit authentication settings."
  }
}
