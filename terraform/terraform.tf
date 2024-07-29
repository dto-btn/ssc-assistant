# Configure the Azure provider
terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.113.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "ScSc-CIO_ECT_Infrastructure-rg"
    storage_account_name = "ectinfra"
    container_name       = "tfstate"
    key                  = "pilot-prod.terraform.tfstate"
  }

  required_version = ">= 1.1.0"
}

provider "azurerm" {
  features {}
  subscription_id = "f5fb90f1-6d1e-4a21-8935-6968d811afd8"
}