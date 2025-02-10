variable "default_location" {
    type    = string
}

variable "project_name" {
    type = string
}

variable "name_prefix" {
    type = string
}


variable "geds_api_token" {
    type = string
    description = "value of the geds api token"
    sensitive = true
}

variable "archibus_api_user" {
    type = string
    default = "apiuser"
}

variable "archibus_api_password" {
    type = string
    sensitive = true
}

variable "jwt_secret" {
    type = string
    sensitive = true
    description = "the jwt secret that will be used to decrypt the access key from the API"
}

variable "aad_client_id_api" {
    type = string
    default = ""
}

variable "allowed_tools"  {
    type = list(string)
    default = ["coporate", "geds"]
}