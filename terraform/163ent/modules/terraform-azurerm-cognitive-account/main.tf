locals {
    ca = var.cognitive_account
}

resource "azurerm_cognitive_account" "cognitive-account" {
    name                = local.ca.name
    resource_group_name = var.resource_group.name
    location            = var.resource_group.location
    sku_name            = try(local.ca.sku_name, "S0")
    kind                = try(local.ca.kind, "OpenAI")

    custom_subdomain_name              = try(local.ca.custom_subdomain_name, null)
    public_network_access_enabled      = try(local.ca.public_network_access_enabled, null)
    outbound_network_access_restricted = try(local.ca.outbound_network_access_restricted, null)
    dynamic_throttling_enabled         = try(local.ca.dynamic_throttling_enabled, null)
    local_auth_enabled                 = try(local.ca.local_auth_enabled, null)
    tags                               = try(local.ca.tags, null)

    dynamic "identity" {
        for_each = try([local.ca.identity], [])
        content {
            type         = identity.value.type
            identity_ids = try(identity.value.identity_ids, null)
        }
    }

    dynamic "customer_managed_key" {
        for_each = local.ca.customer_managed_key == null ? [] : [local.ca.customer_managed_key]
        content {
            key_vault_key_id   = customer_managed_key.value.key_vault_key_id
            identity_client_id = try(customer_managed_key.value.identity_client_id, null)
        }
    }

    dynamic "network_acls" {
        for_each = local.ca.network_acls == null ? [] : [local.ca.network_acls]
        content {
            default_action = network_acls.value.default_action
            ip_rules       = try(network_acls.value.ip_rules, null)

            dynamic "virtual_network_rules" {
                for_each = try(network_acls.value.virtual_network_rules, [])
                content {
                    subnet_id = virtual_network_rules.value.subnet_id
                }
            }
        }
    }

    dynamic "storage" {
        for_each = try(local.ca.storage_accounts, [])
        content {
            storage_account_id = storage.value.storage_account_id
            identity_client_id = try(storage.value.identity_client_id, null)
        }
    }
}