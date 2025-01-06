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

resource "azurerm_role_assignment" "storage_table_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = azurerm_linux_web_app.api.identity.0.principal_id
}

resource "azurerm_role_assignment" "storage_blob_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = azurerm_linux_web_app.api.identity.0.principal_id
}

resource "azurerm_storage_container" "sscplus" {
  name                 = "sscplus-index-data"
  storage_account_name = azurerm_storage_account.main.name
}

/*
* DIAGNOSTICS
*/
resource "azurerm_monitor_diagnostic_setting" "blob" {
  name                        = "sscasssitant-storage-diag-blob"
  target_resource_id          = "${azurerm_storage_account.main.id}/blobServices/default"
  log_analytics_workspace_id  = azurerm_log_analytics_workspace.main.id
  enabled_log {
    category_group = "audit"
  }

  metric {
    category = "Capacity"
    enabled = true
  }
  metric {
    category = "Transaction"
    enabled = true
  }
}

resource "azurerm_monitor_diagnostic_setting" "table" {
  name                        = "sscasssitant-storage-diag-table"
  target_resource_id          = "${azurerm_storage_account.main.id}/tableServices/default"
  log_analytics_workspace_id  = azurerm_log_analytics_workspace.main.id
  enabled_log {
    category_group = "audit"
  }
  metric {
    category = "Capacity"
    enabled = true
  }
  metric {
    category = "Transaction"
    enabled = true
  }
}

resource "azurerm_log_analytics_workspace" "main" {
  name                = "${replace(var.project_name, "_", "")}-aws"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = 30
}