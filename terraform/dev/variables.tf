variable "default_location" {
    type    = string
    default = "canadacentral"
}

variable "project_name" {
    type = string
    default = "ssc_assistant_dev"
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

