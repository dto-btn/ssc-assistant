variable "default_location" {
    type    = string
}

variable "project_name" {
    type = string
}

variable "name_prefix" {
    type = string
}

variable "vite_api_key" {
    type = string
    description = "the jwt token value used to communicate from the frontend to the ssc assistant api"
    sensitive = true
}

variable "microsoft_provider_authentication_secret" {
    type        = string
    sensitive   = true
}

variable "aad_client_id" {
    type = string
}

variable "aad_auth_endpoint" {
    type = string
}

variable "enable_auth" {
    type = bool
    default = true
    description = "this will either enable the auth endpoint or not on the application"
}

variable "rg_name" {
    type = string
    description = "value of the resource group name"
}

variable "log_analytics_workspace_id" {
    type = string
    description = "the id of the log analytics workspace"
}

variable "tenant_id" {
    type = string
    description = "the tenant id"
}

variable "sas_token" {
    type = string
    description = "the sas token"
    sensitive = true
}

variable "blob_endpoint" {
    type = string
    description = "the blob endpoint"
}

variable "subnet_id" {
    type = string
    description = "the subnet id"
}