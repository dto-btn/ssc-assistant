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

resource "azurerm_storage_table" "flagged" {
  name                 = "flagged"
  storage_account_name = azurerm_storage_account.main.name
}

resource "azurerm_storage_table" "suggest" {
  name                 = "suggest"
  storage_account_name = azurerm_storage_account.main.name
}

resource "azurerm_role_assignment" "storage_table_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Table Data Contributor"
  principal_id         = module.api.api_principal_id
}

resource "azurerm_role_assignment" "storage_blob_contributor" {
  scope                = azurerm_storage_account.main.id
  role_definition_name = "Storage Blob Data Contributor"
  principal_id         = module.api.api_principal_id
}

resource "azurerm_storage_container" "sscplus" {
  name                 = "sscplus-index-data"
  storage_account_name = azurerm_storage_account.main.name
}

resource "azurerm_storage_container" "assistantfiles" {
  name                 = "assistant-chat-files"
  storage_account_name = azurerm_storage_account.main.name
  container_access_type = "private"
}

data "azurerm_storage_account_sas" "blob_read_sas" {
  connection_string = azurerm_storage_account.main.primary_connection_string
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