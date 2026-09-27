terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.26"
    }
  }

  backend "s3" {
    bucket       = "arsw-dev-tfstate-559401928721-us-east-1"
    key          = "portfolio/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.region
}

# Reads CLOUDFLARE_API_TOKEN: a DNS:Edit token for the arsw.dev zone locally, a DNS:Read token in CI
provider "cloudflare" {}
