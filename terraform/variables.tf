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