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
