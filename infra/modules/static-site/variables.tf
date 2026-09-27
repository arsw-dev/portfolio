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
}

variable "attach_domains" {
  description = "Attach domains and their certificate to CloudFront. With DNS managed by hand, set false first to request the certificate and get certificate_validation_records, add the records, then set true. The apply that attaches waits for the certificate to be issued"
  type        = bool
  default     = true
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

variable "github_environment" {
  description = "GitHub environment whose jobs may assume the deploy role"
  type        = string
  default     = "production"
}
