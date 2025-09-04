resource "azurerm_cognitive_deployment" "cognitive-deployment" {
    name                   = local.name
    cognitive_account_id   = local.cd.cognitive_account_id
    rai_policy_name       = try(local.cd.rai_policy_name, null)
    version_upgrade_option = try(local.cd.version_upgrade_option, null)

    model {
        format  = local.cd.model.format
        name    = local.cd.model.name
        version = local.cd.model.version
    }

    sku {
        name     = local.cd.sku.name
        tier     = try(local.cd.sku.tier, null)
        size     = try(local.cd.sku.size, null)
        family   = try(local.cd.sku.family, null)
        capacity = try(local.cd.sku.capacity, null)
    }
}