output "frontend_subnet_id" { 
  value = azurerm_subnet.frontend.id
}

output "api_subnet_id" {
  value = azurerm_subnet.api.id
}