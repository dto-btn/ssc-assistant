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


data "azuread_user" "dev1" {
  user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
}

data "azuread_user" "dev2" {
  user_principal_name = "kyle.aitken@ssc-spc.gc.ca"
}

locals {
  all_dev_user_object_ids = flatten([
    data.azuread_user.dev1[*].object_id,
    data.azuread_user.dev2[*].object_id,
  ])
}


resource "azurerm_role_assignment" "storage_table_contributor" {
  for_each             = toset(local.all_dev_user_object_ids)
  scope                = azurerm_storage_account.dev.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = each.value
}