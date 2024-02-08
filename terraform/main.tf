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

data "azurerm_client_config" "current" {}

resource "azurerm_key_vault" "main" {
  name                        = "${replace(var.project_name, "_", "")}keyvault"
  location                    = azurerm_resource_group.main.location
  resource_group_name         = azurerm_resource_group.main.name
  enabled_for_disk_encryption = true
  tenant_id                   = data.azurerm_client_config.current.tenant_id
  soft_delete_retention_days  = 7
  purge_protection_enabled    = false
  sku_name = "standard"

  #TODO: add desired policies ...
  access_policy {
    tenant_id = data.azurerm_client_config.current.tenant_id
    object_id = data.azurerm_client_config.current.object_id

    key_permissions = [
      "Get",
    ]

    secret_permissions = [
      "Get", "Set", "List"
    ]

    storage_permissions = [
      "Get",
    ]
  }
}

resource "azurerm_key_vault_secret" "jwtsecret" {
  name         = "jwt-secret"
  value        = var.jwt_secret
  key_vault_id = azurerm_key_vault.main.id
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