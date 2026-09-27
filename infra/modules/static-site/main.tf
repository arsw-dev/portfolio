data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

locals {
  bucket_name = coalesce(var.bucket_name, "${var.name}-${data.aws_caller_identity.current.account_id}-${data.aws_region.current.name}")
  origin_id   = "s3-${var.name}"

  has_domains = length(var.domains) > 0
  attached    = local.has_domains && var.attach_domains

  tags = merge(var.tags, {
    Name       = var.name
    site       = var.name
    managed_by = "terraform"
  })

  # AWS managed cache policy: Managed-CachingOptimized
  cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"

  # AWS managed response headers policy: Managed-SecurityHeadersPolicy
  # HSTS (1 year), nosniff, X-Frame-Options SAMEORIGIN, strict-origin-when-cross-origin referrer. No CSP.
  response_headers_policy_id = "67f7725c-6f97-4210-82d7-5512b31e9d03"
}
