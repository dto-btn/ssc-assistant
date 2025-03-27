variable "default_location" {
    type    = string
}

variable "project_name" {
    type = string
}

variable "name_prefix" {
    type = string
}

variable "rg_name" {
    type = string
    description = "value of the resource group name"
}

variable "username_postgress" {
    type = string
    description = "value of the username for the postgress server"
}

variable "password_postgress" {
    type = string
    sensitive = true
    description = "password for the username of postgress server"
}

variable "db_name" {
    type = string
    description = "name of the database that will be created"
    default = "sscassistant"
}
