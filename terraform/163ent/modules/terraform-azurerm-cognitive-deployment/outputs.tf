output "deployment_ids" {
    description = "Map of deployment keys to their IDs"
    value = {
        for key, deployment in azurerm_cognitive_deployment.cognitive-deployment : key => deployment.id
    }
}