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

variable "rg_name" {
    type = string
    description = "value of the resource group name"
}

variable "users" {
  description = "List of users"
  type        = list(object({
    name                = string
    user_principal_name = string
    dev                 = bool
  }))
}

variable "subnet_id" {
    type = string
    description = "value of the subnet id"
}

variable "tenant_id" {
    type = string
    description = "the tenant id"
}

variable "blob_endpoint" {
    type = string
    description = "the blob endpoint"
}

variable "table_endpoint" {
    type = string
    description = "the table endpoint"
}

variable "search_service_pk" {
    type = string
    description = "the search service primary key"
    sensitive = true
}

variable "search_service_name" {
    type = string
    description = "the search service name"
}

variable "ai_endpoint" {
    type = string
    description = "the endpoint of the openai service"
}

variable "ai_key" {
    type = string
    description = "the key of the openai service"
    sensitive = true
}

variable "log_analytics_workspace_id" {
    type = string
    description = "the id of the log analytics workspace"
}