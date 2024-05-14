/****************************************************
*                       RG                          *
*****************************************************/
resource "azurerm_resource_group" "dev" {
  name     = "${var.name_prefix}${var.project_name}-rg"
  location = var.default_location
}
