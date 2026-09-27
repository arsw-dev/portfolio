# Publishing for arsw-dev/spa-platform releases. CloudFormation's one-click (quick-create) links only accept templates
# from S3, so each release uploads cloudformation/contractor-role.yaml here, under contractor-role/<tag>/, where it's
# publicly readable. Nothing else in the bucket is public. This needs the account-level S3 Block Public Access
# setting to stay off; turning it on would make these templates unreadable.

locals {
  templates_bucket_name = "arsw-dev-templates-559401928721-us-east-1"
  template_prefix       = "contractor-role/"
  platform_repo         = "arsw-dev/spa-platform"
  github_oidc_url       = "token.actions.githubusercontent.com"
}

resource "aws_s3_bucket" "templates" {
  bucket = local.templates_bucket_name
  tags   = { managed_by = "terraform" }

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "templates" {
  bucket = aws_s3_bucket.templates.id

  versioning_configuration {
    status = "Enabled"
  }
}

# A public bucket policy is the point, so only ACLs stay blocked
resource "aws_s3_bucket_public_access_block" "templates" {
  bucket = aws_s3_bucket.templates.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "templates" {
  bucket = aws_s3_bucket.templates.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadReleasedTemplates"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.templates.arn}/${local.template_prefix}*"
      },
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource  = [aws_s3_bucket.templates.arn, "${aws_s3_bucket.templates.arn}/*"]
        Condition = { Bool = { "aws:SecureTransport" = "false" } }
      },
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.templates]
}

# Assumed only by spa-platform workflows running for a v* tag. It can add templates but never replace or delete one:
# uploads must use If-None-Match: *, so a published version is as immutable as its tag.
resource "aws_iam_role" "release" {
  name = "arsw-dev-spa-platform-release"
  tags = { managed_by = "terraform" }

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = module.bootstrap.github_oidc_provider_arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = { "${local.github_oidc_url}:aud" = "sts.amazonaws.com" }
          StringLike   = { "${local.github_oidc_url}:sub" = "repo:${local.platform_repo}:ref:refs/tags/v*" }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "release" {
  name = "arsw-dev-spa-platform-release"
  role = aws_iam_role.release.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AddTemplatesNeverReplace"
        Effect    = "Allow"
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.templates.arn}/${local.template_prefix}*"
        Condition = { StringEquals = { "s3:if-none-match" = "*" } }
      },
    ]
  })
}

# PR plans must be able to refresh these, like each site's plan_read grant
resource "aws_iam_role_policy" "plan_read_releases" {
  name = "arsw-dev-releases-plan-read"
  role = module.bootstrap.plan_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadTemplatesBucketConfiguration"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:Get*", "s3:ListTagsForResource"]
        Resource = aws_s3_bucket.templates.arn
      },
      {
        Sid      = "ReadReleaseRole"
        Effect   = "Allow"
        Action   = ["iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"]
        Resource = aws_iam_role.release.arn
      },
    ]
  })
}
