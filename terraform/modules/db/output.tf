output "postgres_connection_string" {
  value = "postgresql://${var.username_postgress}:${var.password_postgress}@${azurerm_postgresql_flexible_server.db.name}.postgres.database.azure.com:5432/${var.db_name}"
  description = "The PostgreSQL connection string"
  sensitive = true
}
