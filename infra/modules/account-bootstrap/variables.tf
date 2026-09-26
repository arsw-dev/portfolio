variable "name" {
  description = "Prefix for account-level resource names (e.g. the plan role)"
  type        = string
}

variable "state_bucket_name" {
  description = "S3 bucket for Terraform state"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository (owner/repo) whose pull requests may assume the plan role"
  type        = string
}

variable "create_github_oidc_provider" {
  description = "Create the GitHub Actions OIDC provider. Set false if the account already has one (AWS allows only one per URL)"
  type        = bool
  default     = true
}

variable "tags" {
  description = "Extra tags for taggable resources. managed_by is always set"
  type        = map(string)
  default     = {}
}
