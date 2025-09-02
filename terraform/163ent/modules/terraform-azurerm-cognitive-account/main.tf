resource "azurerm_cognitive_account" "cognitive-account" {
    name                = var.name
    resource_group_name = var.rg_name
    location            = var.location
    sku_name            = var.sku_name
    kind                = var.kind
}