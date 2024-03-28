/****************************************************
*                      STORAGE                      *
*****************************************************/
resource "azurerm_storage_account" "main" {
  name                     = "${replace(var.project_name, "_", "")}storage"
  resource_group_name      = azurerm_resource_group.main.name
  location                 = azurerm_resource_group.main.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_table" "feedback" {
  name                 = "feedback"
  storage_account_name = azurerm_storage_account.main.name
}

resource "azurerm_storage_table" "chat" {
  name                 = "chat"
  storage_account_name = azurerm_storage_account.main.name
}