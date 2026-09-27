variable "name" {
  description = "Short site identifier, used in resource names and tags"
  type        = string
}

variable "domains" {
  description = "Custom domains for the site. The first is canonical; all become certificate names and, once attached, CloudFront aliases. Empty runs the site at its *.cloudfront.net preview address only"
  type        = list(string)
  default     = []

  validation {
    condition     = length(distinct(var.domains)) == length(var.domains)
    error_message = "domains must not contain duplicates."
  }

  validation {
    condition     = alltrue([for domain in var.domains : !startswith(domain, "*.")])
    error_message = "Wildcard domains aren't supported: their validation record duplicates the apex's."
  }
}

variable "attach_domains" {
  description = "Attach domains and their certificate to CloudFront. With DNS managed by hand, set false first to request the certificate and get certificate_validation_records, add the records, then set true. The apply that attaches waits for the certificate to be issued"
  type        = bool
  default     = true
}

variable "validation_record_fqdns" {
  description = "Names of the certificate validation records, when the caller creates them in the same apply (for example from the cloudflare-dns module). Orders validation after the records exist"
  type        = list(string)
  default     = null
}

variable "noncurrent_version_retention_days" {
  description = "Days to keep overwritten or deleted site files (bucket versioning) before they expire"
  type        = number
  default     = 7

  validation {
    condition     = var.noncurrent_version_retention_days >= 1
    error_message = "noncurrent_version_retention_days must be at least 1."
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

variable "tags" {
  description = "Extra tags for taggable resources. Name, site and managed_by are always set"
  type        = map(string)
  default     = {}
}

variable "github_repo" {
  description = "GitHub repository (owner/repo) allowed to deploy the site"
  type        = string
}

variable "plan_role_name" {
  description = "Name of the account's Terraform plan role (account-bootstrap's plan_role_name output). When set, this site grants it read access to its own resources so pull-request plans work. Null skips the grant"
  type        = string
  default     = null
}

variable "github_environment" {
  description = "GitHub environment whose jobs may assume the deploy role"
  type        = string
  default     = "production"
}
