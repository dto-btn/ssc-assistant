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

    certificate_permissions = [
      "Create",
      "Delete",
      "Get",
      "Import",
      "List",
      "Update",
    ]
  }
}

resource "azurerm_key_vault_secret" "jwtsecret" {
  name         = "jwt-secret"
  value        = var.jwt_secret
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_secret" "pfxsecret" {
  name         = "pfx-secret"
  value        = var.pfx_secret
  key_vault_id = azurerm_key_vault.main.id
}

resource "azurerm_key_vault_certificate" "import-cert" {
  name         = "ssc-assistant-cert"
  key_vault_id = azurerm_key_vault.main.id

  certificate {
    contents = filebase64("certificates/ssc-assistant-sandbox.pfx")
    password = var.pfx_secret
  }
}

/****************************************************
*                        DNS                        *
*****************************************************/
data "azurerm_dns_zone" "main" {
  name                = "cio-sandbox-ect.ssc-spc.cloud-nuage.canada.ca"
  resource_group_name = "ScSc-CIO_ECT_DNS-rg"
}

resource "azurerm_dns_cname_record" "assistant" {
  name                = "assistant"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_dns_zone.main.resource_group_name
  ttl                 = 3600
  record              = azurerm_linux_web_app.frontend.default_hostname
}

resource "azurerm_dns_txt_record" "assistant" {
  name                = "asuid.assistant"
  zone_name           = data.azurerm_dns_zone.main.name
  resource_group_name = data.azurerm_dns_zone.main.resource_group_name
  ttl                 = 300
  record {
    value = "78b0199e2df7d755f121ad995a9192f55622702ae3526f9a4bc826bac852574d"
  }
}