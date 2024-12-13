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
      name = "dev-mw"
      user_principal_name = "Monarch.Wadia@ssc-spc.gc.ca"
    },
    { 
      name = "codyrobillard"
      user_principal_name = "cody.robillard@ssc-spc.gc.ca"
    },
    { 
      name = "jeneerthan_pageerathan"
      user_principal_name = "jeneerthan.pageerathan@ssc-spc.gc.ca"
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
#             Sub Contributors/Reader                 #
#######################################################
# resource "azurerm_role_assignment" "sub-contri-1" {
#   scope                = azurerm_resource_group.dev.id
#   role_definition_name = "Contributor"
#   principal_id         = ###
# }

#Read Sub and Use OpenAI services
resource "azurerm_role_assignment" "sub-read" {
  for_each             = data.azuread_user.users
  scope                = azurerm_resource_group.dev.id
  role_definition_name = "Reader"
  principal_id         = each.value.id
}
resource "azurerm_role_assignment" "openai_user" {
  for_each             = data.azuread_user.users
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai.id
  principal_id         = each.value.id
}
#######################################################
#                      APPS                           #
#######################################################
resource "azurerm_role_assignment" "api_read_openai" {
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai.id
  principal_id = azurerm_linux_web_app.api.identity[0].principal_id
}
