resource "azurerm_postgresql_server" "db" {
  name                = "${var.name_prefix}${var.project_name}-postgress"
  location            = var.default_location
  resource_group_name = var.rg_name

  sku_name = "Standard_B1ms"

  storage_mb                   = 32768
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  auto_grow_enabled            = true

  administrator_login          = var.username_postgress
  administrator_login_password = var.password_postgress
  version                      = "16"
  ssl_enforcement_enabled      = true
}

resource "azurerm_postgresql_database" "db" {
  name                = var.db_name
  resource_group_name = var.rg_name
  server_name         = azurerm_postgresql_server.db.name
  charset             = "UTF8"
  collation           = "en_US.utf8"

  # prevent the possibility of accidental data loss
  lifecycle {
    prevent_destroy = true
  }
}
