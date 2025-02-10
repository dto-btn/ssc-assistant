/****************************************************
*                       RG                          *
*****************************************************/
resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}

module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  name_prefix = var.name_prefix
  default_location = var.default_location
  jwt_secret = var.jwt_secret
  microsoft_provider_authentication_secret = var.microsoft_provider_authentication_secret
  aad_client_id = var.aad_client_id
  aad_auth_endpoint = var.aad_auth_endpoint
  enable_auth = true
}