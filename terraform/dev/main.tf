/****************************************************
*                       RG                          *
*****************************************************/
resource "azurerm_resource_group" "dev" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}

data "azurerm_client_config" "current" {}

/****************************************************
*                      VNET                         *
*****************************************************/
# module "vnet" {
#   source = "../modules/vnet"

#   rg_name = azurerm_resource_group.dev.name

#   project_name = var.project_name
#   name_prefix = var.name_prefix
#   default_location = var.default_location
# }

/****************************************************
*                       API                         *
*****************************************************/
# module "api" {
#   source = "../modules/api"

#   rg_name = azurerm_resource_group.dev.name

#   users = local.users
#   subnet_id = module.vnet.api_subnet_id

#   tenant_id = data.azurerm_client_config.current.tenant_id

#   table_endpoint = azurerm_storage_account.dev.primary_table_endpoint
#   blob_endpoint = azurerm_storage_account.dev.primary_blob_endpoint

#   project_name = var.project_name
#   name_prefix = var.name_prefix
#   default_location = var.default_location
#   archibus_api_password = var.archibus_api_password
#   geds_api_token = var.geds_api_token
#   jwt_secret = var.jwt_secret

#   search_service_name = data.azurerm_search_service.main.name
#   search_service_pk = data.azurerm_search_service.main.primary_key
#   ai_endpoint = data.azurerm_cognitive_account.ai.endpoint
#   ai_key = data.azurerm_cognitive_account.ai.primary_access_key

#   allowed_tools = ["corporate", "geds", "archibus", "bits"]
# }

/****************************************************
*                     OpenAI                        *
*****************************************************/
data "azurerm_resource_group" "ai" {
  name = var.openai_rg
}

data "azurerm_cognitive_account" "ai" {
  name                = var.openai_name
  resource_group_name = var.openai_rg
  //kind = "OpenAI"
}

data "azurerm_search_service" "main" {
  resource_group_name   = "ScSc-CIO_ECT_ssc_assistant-rg"
  name   = "ssc-assistant-search-service"
}

/****************************************************
*                         DB                        *
*****************************************************/
module "postgress" {
  source = "../modules/db"

  project_name = var.project_name
  default_location = var.default_location
  rg_name = azurerm_resource_group.dev.name
  name_prefix = var.name_prefix
  username_postgress = var.username_postgress
  password_postgress = var.password_postgress
}
