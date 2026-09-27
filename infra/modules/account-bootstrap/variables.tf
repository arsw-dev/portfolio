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

variable "state_keys" {
  description = "State file keys in the state bucket that the plan role may read, one per Terraform root (e.g. site/terraform.tfstate)"
  type        = list(string)

  validation {
    condition     = length(var.state_keys) > 0 && alltrue([for key in var.state_keys : !strcontains(key, "*")])
    error_message = "state_keys must name at least one exact key, without wildcards."
  }
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
