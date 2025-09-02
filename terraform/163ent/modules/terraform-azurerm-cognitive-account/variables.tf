variable "name" {
    type = string
    description = "The name of the Cognitive Services account. Only alphanumeric characters and hyphens are allowed. The value must be 2-64 characters long and cannot start or end with a hyphen."
}

variable "rg_name" {
    type = string
    description = "The name of the resource group."
}

variable "location" {
    type = string
    description = "The Azure location where the Cognitive Services account should be created."
}

variable "sku_name" {
    type = string
    description = "The SKU name of the Cognitive Services account."
    default = "S0"
}

variable "kind" {
    type = string
    description = "The kind of the Cognitive Services account."
    default = "OpenAI"
}