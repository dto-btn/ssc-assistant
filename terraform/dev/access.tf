#######################################################
#                     USERS                           #
#######################################################
data "azuread_user" "dev-gt" {
  user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
}

data "azuread_user" "po-af" {
  user_principal_name = "alain.forcier@ssc-spc.gc.ca"
}

data "azuread_user" "dev-harsha" {
  user_principal_name = "harsha.kakumanu@ssc-spc.gc.ca"
}

data "azuread_service_principal" "terraform" {
  display_name = "Terraform-CIO-Automation-SP"
}

#######################################################
#                   Sub Contributors                  #
#######################################################
resource "azurerm_role_assignment" "sub-contri-1" {
  scope                = azurerm_resource_group.dev.id
  role_definition_name = "Contributor"
  principal_id         = data.azuread_user.dev-harsha.object_id
}