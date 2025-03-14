output "postgres_connection_string" {
  value = "postgresql://${var.username_postgress}:${var.password_postgress}@${azurerm_postgress_server.db.url}:${azurerm_postgress_server.db.port}/${var.db_name}"
  description = "The PostgreSQL connection string"
  sensitive = true
}
