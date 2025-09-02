output "id" {
	description = "The ID of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.id
}

output "endpoint" {
	description = "The base endpoint URL of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.endpoint
}

output "identity" {
	description = "The identity block with principal and tenant IDs"
	value       = try(azurerm_cognitive_account.cognitive-account.identity, null)
}

output "name" {
	description = "The name of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.name
}

output "location" {
	description = "The Azure location of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.location
}

output "kind" {
	description = "Kind of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.kind
}

output "sku_name" {
	description = "SKU name of the Cognitive Account"
	value       = azurerm_cognitive_account.cognitive-account.sku_name
}

output "primary_access_key" {
	description = "Primary access key"
	value       = azurerm_cognitive_account.cognitive-account.primary_access_key
	sensitive   = true
}

output "secondary_access_key" {
	description = "Secondary access key"
	value       = azurerm_cognitive_account.cognitive-account.secondary_access_key
	sensitive   = true
}

output "primary_connection_string" {
	description = "Primary connection string"
	value       = azurerm_cognitive_account.cognitive-account.primary_connection_string
	sensitive   = true
}

output "secondary_connection_string" {
	description = "Secondary connection string"
	value       = azurerm_cognitive_account.cognitive-account.secondary_connection_string
	sensitive   = true
}
