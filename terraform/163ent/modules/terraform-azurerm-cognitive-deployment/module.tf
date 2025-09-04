resource "azurerm_cognitive_deployment" "cognitive-deployment" {
    for_each = var.cognitive_deployments

    name                    = each.key
    cognitive_account_id    = each.value.cognitive_account_id
    rai_policy_name         = try(each.value.rai_policy_name, null)
    version_upgrade_option  = try(each.value.version_upgrade_option, null)
    dynamic_throttling_enabled = try(each.value.dynamic_throttling_enabled, null)

    model {
        format  = each.value.model.format
        name    = each.value.model.name
        version = each.value.model.version
    }

    sku {
        name     = each.value.sku.name
        tier     = try(each.value.sku.tier, null)
        size     = try(each.value.sku.size, null)
        family   = try(each.value.sku.family, null)
        capacity = try(each.value.sku.capacity, null)
    }
}