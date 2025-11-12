/****************************************************
*                      STORAGE                      *
*****************************************************/
resource "azurerm_storage_account" "dev" {
  name                     = "${replace(var.project_name, "_", "")}storage"
  resource_group_name      = azurerm_resource_group.dev.name
  location                 = azurerm_resource_group.dev.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_table" "feedback" {
  name                 = "feedback"
  storage_account_name = azurerm_storage_account.dev.name
}

resource "azurerm_storage_table" "chat" {
  name                 = "chat"
  storage_account_name = azurerm_storage_account.dev.name
}

resource "azurerm_storage_table" "flagged" {
  name                 = "flagged"
  storage_account_name = azurerm_storage_account.dev.name
}

resource "azurerm_storage_table" "suggest" {
  name                 = "suggest"
  storage_account_name = azurerm_storage_account.dev.name
}

resource "azurerm_storage_container" "assistantfiles" {
  name                 = "assistant-chat-files"
  storage_account_name = azurerm_storage_account.dev.name
  container_access_type = "private"
}

data "azurerm_storage_account_sas" "blob_read_sas" {
  connection_string = azurerm_storage_account.dev.primary_connection_string
  https_only        = true
  #signed_version    = "2022-11-02"

  resource_types {
    service   = false
    container = false
    object    = true
  }

  services {
    blob  = true
    queue = false
    table = false
    file  = false
  }

  permissions {
    read    = true
    write   = false
    delete  = false
    list    = false
    add     = false
    create  = false
    update  = false
    process = false
    tag     = false
    filter  = false
  }

  start = "2025-01-01T00:00:00Z"  # Set this to the desired start time
  expiry = "2030-12-31T23:59:59Z"  # Set this to the desired expiry time
}

data "azuread_user" "dev1" {
  user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
}

locals {
  all_dev_user_object_ids = flatten([
    data.azuread_user.dev1[*].object_id,
  ])
}

resource "azurerm_role_assignment" "storage_table_contributor_api" {
  scope                = azurerm_storage_account.dev.id
  role_definition_name = "Storage Table Data Contributor"
  #principal_id         = module.api.api_principal_id
  principal_id = azurerm_linux_web_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "storage_blob_contributor_api" {
  scope                = azurerm_storage_account.dev.id
  role_definition_name = "Storage Blob Data Contributor"
  #principal_id         = module.api.api_principal_id
  principal_id = azurerm_linux_web_app.api.identity[0].principal_id
}

resource "azurerm_role_assignment" "storage_table_contributor" {
  for_each             = toset(local.all_dev_user_object_ids)
  scope                = azurerm_storage_account.dev.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = each.value
}
