resource "azuread_group" "owners" {
  display_name = "ScSc-CIO_ECT_Subscription_Owners"
  # owners # Managed by Infra group, do not alter.
  members = [ data.azuread_user.dev-gt.object_id, data.azuread_user.po-af.object_id, data.azuread_service_principal.terraform.object_id ]
  security_enabled = true
}

resource "azuread_group" "contributors" {
  display_name = "ScSc-CIO_ECT_Subscription_Contributors"
  # owners # Managed by Infra group, do not alter.
  members = [ data.azuread_user.dev-gt.object_id ]
  security_enabled = true
}

/**
* We do not have control over this group.
*/
resource "azuread_group" "readers" {
  display_name = "ScSc-CIO_ECT_Subscription_Readers"
  security_enabled = true
}

#######################################################
#                     USERS                           #
#######################################################
locals {
  users = [
    { 
      name = "dev-gt"
      user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
    },
    { 
      name = "po-af"
      user_principal_name = "alain.forcier@ssc-spc.gc.ca"
    },
    { 
      name = "tl-davids"
      user_principal_name = "david.simard@ssc-spc.gc.ca"
    }
  ]
}

data "azuread_user" "users" {
  for_each = {
    for user in local.users:
      user.name => user
    }
  user_principal_name = each.value.user_principal_name
}

data "azuread_service_principal" "terraform" {
  display_name = "Terraform-CIO-Automation-SP"
}

#######################################################
#                     Sub Readers                     #
#######################################################
# resource "azurerm_role_assignment" "sub-read-1" {
#   scope                = azurerm_resource_group.main.id
#   role_definition_name = "Reader"
#   principal_id         = ###
# }

#######################################################
#             Cognitive Search Contributor            #
#######################################################

data "azurerm_resource_group" "aoi" {
  name = var.openai_rg
}

# resource "azurerm_role_assignment" "cogn-search-contri-1" {
#   scope                = data.azurerm_resource_group.aoi.id
#   role_definition_name = "Cognitive Services User"
#   principal_id         = #
# }