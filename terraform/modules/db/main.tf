resource "azurerm_postgresql_flexible_server" "db" {
  # name                = lower(replace("${var.name_prefix}${var.project_name}_postgress", "_", "-"))
  name                = "${var.project_name}-postgres"
  location            = var.default_location
  resource_group_name = var.rg_name

  sku_name = "B_Standard_B1ms"

  storage_mb                   = 32768
  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  auto_grow_enabled            = true

  administrator_login          = var.username_postgress
  administrator_password       = var.password_postgress
  version                      = "16"

  zone = "1"
}

resource "azurerm_postgresql_flexible_server_database" "db" {
  name                = var.db_name
  server_id           = azurerm_postgresql_flexible_server.db.id
  charset             = "UTF8"
  collation           = "en_US.utf8"

  # prevent the possibility of accidental data loss
  lifecycle {
    prevent_destroy = true
  }
}
