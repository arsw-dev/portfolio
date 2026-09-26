variable "name" {
  description = "Short site identifier, used in resource names and tags"
  type        = string
}

variable "domains" {
  description = "Domains served by the site. The first is canonical; all become CloudFront aliases and certificate names"
  type        = list(string)

  validation {
    condition     = length(var.domains) > 0
    error_message = "At least one domain is required."
  }
}

variable "bucket_name" {
  description = "S3 bucket name. Defaults to <name>-<account id>-<region>"
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class"
  type        = string
  default     = "PriceClass_All"
}

variable "legacy_names" {
  description = "Temporary: console-generated names on resources imported from the original portfolio setup. Removed once those resources are renamed."
  type = object({
    origin_id       = string
    oac_name        = string
    oac_description = string
  })
  default = null
}
