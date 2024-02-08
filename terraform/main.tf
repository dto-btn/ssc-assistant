/****************************************************
*                       RG                          *
*****************************************************/
resource "azurerm_resource_group" "main" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}

/****************************************************
*                     OpenAI                        *
*****************************************************/
data "azurerm_cognitive_account" "ai" {
  name                = var.openai_name
  resource_group_name = var.openai_rg
  //kind = "OpenAI"
}

/****************************************************
*                STORAGE / KEYVAULT                 *
*****************************************************/
resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.project_name, "_", "")}storage"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

/****************************************************
*                        DNS                        *
*****************************************************/
data "azurerm_dns_zone" "main" {
  name = var.dns_zone_name
  resource_group_name = var.dns_zone_rg
}

resource "azurerm_dns_cname_record" "data" {
  name                = "api"
  zone_name           = var.dns_zone_name
  resource_group_name = var.dns_zone_rg
  ttl                 = 300
  record              = azurerm_linux_web_app.api.default_hostname
}