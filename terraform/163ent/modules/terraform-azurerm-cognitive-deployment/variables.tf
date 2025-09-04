variable "resource_group" {
    description = "Resource group object containing name and location."
    type = any
}

variable "cognitive_deployment" {
    description = "Cognitive deployment configuration object."
    type = object({
        cognitive_account_id = string
        model = object({
            format  = string
            name    = string
            version = string
        })
        sku = object({
            name     = string
            tier     = optional(string)
            size     = optional(string)
            family   = optional(string)
            capacity = optional(number)
        })
        rai_policy_name = optional(string)
        version_upgrade_option = optional(string)
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
  description = "Tags to be applied to the cognitive deployment"
  type = map(string)
  default = {}
}