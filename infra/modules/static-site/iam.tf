# Deploy role for GitHub Actions. Only jobs running in the given GitHub environment can assume it,
# and it can only touch this site's bucket and distribution.
# Expects the account's GitHub OIDC provider to exist (see modules/account-bootstrap).

locals {
  github_oidc_url          = "token.actions.githubusercontent.com"
  github_oidc_provider_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:oidc-provider/${local.github_oidc_url}"
}

resource "aws_iam_role" "deploy" {
  name = "${var.name}-deploy"
  tags = local.tags

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect    = "Allow"
        Principal = { Federated = local.github_oidc_provider_arn }
        Action    = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringEquals = {
            "${local.github_oidc_url}:aud" = "sts.amazonaws.com"
            "${local.github_oidc_url}:sub" = "repo:${var.github_repo}:environment:${var.github_environment}"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "deploy" {
  name = "${var.name}-deploy"
  role = aws_iam_role.deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = "s3:ListBucket"
        Resource = aws_s3_bucket.this.arn
      },
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.this.arn}/*"
      },
      {
        Effect   = "Allow"
        Action   = "cloudfront:CreateInvalidation"
        Resource = aws_cloudfront_distribution.this.arn
      },
    ]
  })
}
