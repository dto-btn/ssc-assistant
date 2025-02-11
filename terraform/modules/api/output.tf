output "backend_hostname" {
  value = azurerm_linux_web_app.api.default_hostname
}

output "api_principal_id" {
  value = azurerm_linux_web_app.api.identity.0.principal_id
}