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

variable "dns_zone_name" {
    type = string
    default = "cio-sandbox-ect.ssc-spc.cloud-nuage.canada.ca"
}

variable "dns_zone_rg" {
    type = string
    default = "ScSc-CIO_ECT_DNS-rg"
}

variable "jwt_secret" {
    type = string
    sensitive = true
    description = "the jwt secret that will be used to decrypt the access key provided to the backend devs"
}