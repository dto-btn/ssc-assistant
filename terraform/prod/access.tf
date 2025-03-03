#######################################################
#                     USERS                           #
#######################################################
locals {
  users = [
    { 
      name = "dev-gt"
      user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
      dev = true
    },
    { 
      name = "po-af"
      user_principal_name = "alain.forcier@ssc-spc.gc.ca"
      dev = false
    },
    { 
      name = "dev-mw"
      user_principal_name = "Monarch.Wadia@ssc-spc.gc.ca"
      dev = true
    },
  ]

  devs = [for user in local.users: user if user.dev]
}

data "azuread_user" "users" {
  for_each = {
    for user in local.users:
      user.name => user
    }
  user_principal_name = each.value.user_principal_name
}

data "azuread_user" "devs" {
  for_each = {
    for user in local.devs:
      user.name => user
    }
  user_principal_name = each.value.user_principal_name
}

#######################################################
#                   PERMISSIONS                       #
#######################################################
resource "azurerm_role_assignment" "sub-read" {
  for_each             = data.azuread_user.users
  scope                = azurerm_resource_group.main.id
  role_definition_name = "Reader"
  principal_id         = each.value.id
}