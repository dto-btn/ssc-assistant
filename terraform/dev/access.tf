#######################################################
#                     USERS                           #
#######################################################
data "azuread_user" "dev-gt" {
  user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
}

data "azuread_user" "po-af" {
  user_principal_name = "alain.forcier@ssc-spc.gc.ca"
}

data "azuread_user" "codyrobillard" {
  user_principal_name = "cody.robillard@ssc-spc.gc.ca"
}

data "azuread_user" "jeneerthan_pageerathan" {
  user_principal_name = "jeneerthan.pageerathan@ssc-spc.gc.ca"
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
resource "azurerm_role_assignment" "sub-read-cody" {
  scope                = azurerm_resource_group.dev.id
  role_definition_name = "Reader"
  principal_id         = data.azuread_user.codyrobillard.id
}
resource "azurerm_role_assignment" "openai_user_cody" {
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai.id
  principal_id = data.azuread_user.codyrobillard.id
}

resource "azurerm_role_assignment" "sub_read_jeneerthan_pageerathan" {
  scope                = azurerm_resource_group.dev.id
  role_definition_name = "Reader"
  principal_id         = data.azuread_user.jeneerthan_pageerathan.id
}
resource "azurerm_role_assignment" "openai_user_jeneerthan_pageerathan" {
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai.id
  principal_id = data.azuread_user.jeneerthan_pageerathan.id
}

#######################################################
#                      APPS                           #
#######################################################
resource "azurerm_role_assignment" "api_read_openai" {
  role_definition_name = "Cognitive Services User"
  scope = data.azurerm_resource_group.ai.id
  principal_id = azurerm_linux_web_app.api.identity[0].principal_id
}
