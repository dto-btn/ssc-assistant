/****************************************************
*                       RG                          *
*****************************************************/
resource "azurerm_resource_group" "dev" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}

data "azurerm_client_config" "current" {}

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

# data "azurerm_search_service" "main" {
#   resource_group_name   = "ScSc-CIO_ECT_ssc_assistant-rg"
#   name   = "ssc-assistant-search-service"
# }
