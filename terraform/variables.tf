variable "default_location" {
    type    = string
    default = "canadacentral"
}

variable "project_name" {
    type = string
    default = "ssc_assistant"
}

variable "name_prefix" {
    type = string
    default = "ScSc-CIO_ECT_"
    description = "following ssc's cloud naming convention document"
}

variable "name_prefix_lowercase" {
    type = string
    default = "scsccioect"
}

variable "openai_rg" {
    type = string
    default = "ScSc-CIO-ECT-OpenAI-rg"
}

variable "openai_name" {
    type = string
    default = "ScSc-CIO-ECT-OpenAI-oai"
}

variable "jwt_secret" {
    type = string
    sensitive = true
    description = "the jwt secret that will be used to decrypt the access key from the API"
}

variable "pfx_secret" {
    type = string
    sensitive = true
    description = "the pfx secret for the private key"
}

# those 2 must be provided, along with the secret.. (microsoft_provider_authentication_secret)
variable "microsoft_provider_authentication_secret" {
    type        = string
    sensitive   = true
}

variable "aad_client_id" {
    type = string
    default = "fa97a723-f604-438b-8bd6-06543065f6a9"
}

variable "aad_client_id_api" {
    type = string
    default = ""
}

variable "aad_auth_endpoint" {
    type = string
    default = "https://sts.windows.net/d05bc194-94bf-4ad6-ae2e-1db0f2e38f5e/v2.0"
}

variable "enable_auth" {
    type = bool
    default = true
    description = "this will either enable the auth endpoint or not on the application"
}

variable "vite_api_key" {
    type = string
    description = "the jwt token value used to communicate from the frontend to the ssc assistant api"
    sensitive = true
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

variable "username_postgress" {
    type = string
    description = "value of the username for the postgress server"
}

variable "password_postgress" {
    type = string
    sensitive = true
    description = "password for the username of postgress server"
}