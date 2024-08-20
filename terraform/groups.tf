resource "azuread_group" "owners" {
  display_name = "ScSc-CIO_ECT_Subscription_Owners"
  # owners # Managed by Infra group, do not alter.
  members = [ data.azuread_user.dev-gt.object_id, data.azuread_user.po-af.object_id, data.azuread_service_principal.terraform.object_id ]
  security_enabled = true
}

resource "azuread_group" "contributors" {
  display_name = "ScSc-CIO_ECT_Subscription_Contributors"
  # owners # Managed by Infra group, do not alter.
  members = [ data.azuread_user.dev-gt.object_id, data.azuread_user.dev-ka.object_id ]
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
data "azuread_user" "dev-gt" {
  user_principal_name = "guillaume.turcotte2@ssc-spc.gc.ca"
}

data "azuread_user" "dev-ka" {
  user_principal_name = "kyle.aitken@ssc-spc.gc.ca"
}

data "azuread_user" "po-af" {
  user_principal_name = "alain.forcier@ssc-spc.gc.ca"
}

data "azuread_service_principal" "terraform" {
  display_name = "Terraform-CIO-Automation-SP"
}