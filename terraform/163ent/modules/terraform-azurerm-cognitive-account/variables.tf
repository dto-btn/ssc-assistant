variable "resource_group" {
    description = "Resource group object containing name and location."
    type = any
}

variable "cognitive_account" {
    description = "Cognitive account configuration object."
    type = object({
        sku_name                          = optional(string)
        kind                              = optional(string)
        custom_subdomain_name             = optional(string)
        public_network_access_enabled     = optional(bool)
        outbound_network_access_restricted = optional(bool)
        dynamic_throttling_enabled        = optional(bool)
        local_auth_enabled                = optional(bool)
        tags                              = optional(map(string))
        identity = optional(object({
            type         = string
            identity_ids = optional(list(string))
        }))
        customer_managed_key = optional(object({
            key_vault_key_id   = string
            identity_client_id = optional(string)
        }))
        network_acls = optional(object({
            default_action        = string
            ip_rules              = optional(list(string))
            virtual_network_rules = optional(list(object({ subnet_id = string })))
        }))
        storage_accounts = optional(list(object({
            storage_account_id = string
            identity_client_id = optional(string)
        })))
    })
}

# Additional variables referenced in locals.tf for naming convention
variable "env" {
    description = "Deployment environment code (e.g., dev, test, prod)."
    type        = string
    validation {
        condition     = can(regex("^[A-Z][0-9,a-z][A-Z][0-9,a-z]$", var.env))
        error_message = "env must be exactly 4 characters matching pattern Upper-lower-Upper-lower (e.g., AbCd) and contain only alphanumeric characters."
    }
}

variable "group" {
    description = "Business or organizational group identifier used in resource naming."
    type        = string
    validation {
        condition   = can(regex("^[A-Za-z0-9]+$", var.group))
        error_message = "group may only contain alphanumeric characters (A-Z, a-z, 0-9) with no spaces or special characters."
    }
}

variable "project" {
    description = "Short project identifier used in resource naming."
    type        = string
    validation {
        condition   = can(regex("^[A-Za-z0-9]+$", var.project))
        error_message = "project may only contain alphanumeric characters (A-Z, a-z, 0-9) with no spaces or special characters."
    }
}

variable "userDefinedString" {
    description = "Free-form suffix/purpose string included in resource names (no spaces)."
    type        = string
    validation {
        condition   = can(regex("^[A-Za-z0-9]+$", var.userDefinedString))
        error_message = "userDefinedString may only contain alphanumeric characters (A-Z, a-z, 0-9) with no spaces or special characters."
    }
}

variable "tags" {
  description = "Tags to be applied to the function app"
  type = map(string)
  default = {}
}