variable "default_location" {
    type    = string
    default = "canadacentral"
}

variable "project_name" {
    type = string
    default = "ssc_assistant_prod"
}

variable "name_prefix" {
    type = string
    default = "ScPc-CIO_ECT_"
    description = "following ssc's cloud naming convention document"
}