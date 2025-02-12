/****************************************************
*                  PROD STACK                       *
*****************************************************/
resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}

data "azurerm_client_config" "current" {}

module "vnet" {
  source = "../modules/vnet"

  rg_name = azurerm_resource_group.main.name

  project_name = var.project_name
  name_prefix = var.name_prefix
  default_location = var.default_location
}

module "frontend" {
  source = "../modules/frontend"

  rg_name = azurerm_resource_group.main.name

  blob_endpoint = azurerm_storage_account.main.primary_blob_endpoint
  sas_token = data.azurerm_storage_account_sas.blob_read_sas.sas
  tenant_id = data.azurerm_client_config.current.tenant_id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id
  subnet_id = module.vnet.frontend_subnet_id

  project_name = var.project_name
  name_prefix = var.name_prefix
  default_location = var.default_location
  vite_api_key = var.vite_api_key
  aad_client_id = var.aad_client_id
  microsoft_provider_authentication_secret = var.microsoft_provider_authentication_secret
  aad_auth_endpoint = var.aad_auth_endpoint
}

module "api" {
  source = "../modules/api"

  rg_name = azurerm_resource_group.main.name

  users = local.users
  subnet_id = module.vnet.api_subnet_id

  tenant_id = data.azurerm_client_config.current.tenant_id

  table_endpoint = azurerm_storage_account.main.primary_table_endpoint
  blob_endpoint = azurerm_storage_account.main.primary_blob_endpoint

  project_name = var.project_name
  name_prefix = var.name_prefix
  default_location = var.default_location
  archibus_api_password = var.archibus_api_password
  geds_api_token = var.geds_api_token
  jwt_secret = var.jwt_secret

  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  search_service_name = azurerm_search_service.main.name
  search_service_pk = azurerm_search_service.main.primary_key
  ai_endpoint = azurerm_cognitive_account.ai.endpoint
  ai_key = azurerm_cognitive_account.ai.primary_access_key
}

/****************************************************
*            LOG ANALYTICS WORKSPACE                *
*****************************************************/
resource "azurerm_log_analytics_workspace" "main" {
  name                = "${replace(var.project_name, "_", "")}-aws"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}