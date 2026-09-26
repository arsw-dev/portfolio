data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  bucket_name = coalesce(var.bucket_name, "${var.name}-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}")

  origin_id       = try(var.legacy_names.origin_id, "s3-${var.name}")
  oac_name        = try(var.legacy_names.oac_name, var.name)
  oac_description = try(var.legacy_names.oac_description, "CloudFront access to the ${var.name} bucket")

  # AWS managed cache policy: Managed-CachingOptimized
  cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
}
