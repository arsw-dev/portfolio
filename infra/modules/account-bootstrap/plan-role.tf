# Read-only role for `terraform plan` on pull requests. It can read state and the resources Terraform manages,
# and write only its roots' lock files. It cannot change anything.

resource "aws_iam_role" "plan" {
  name = "${var.name}-terraform-plan"
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
            "${local.github_oidc_url}:sub" = "repo:${var.github_repo}:pull_request"
          }
        }
      }
    ]
  })

  depends_on = [aws_iam_openid_connect_provider.github]
}

resource "aws_iam_role_policy" "plan" {
  name = "${var.name}-terraform-plan"
  role = aws_iam_role.plan.id

  # Only what this module manages: the state files it's told about, the state bucket's configuration, the GitHub
  # OIDC provider and this role. Each site grants read on its own resources (static-site's plan_role_name), so
  # nothing here reaches the rest of the account. Actions match what plans were observed calling (CloudTrail).
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadState"
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = [for key in var.state_keys : "${aws_s3_bucket.state.arn}/${key}"]
      },
      {
        # Plans take the lock; only these exact lock files, so a PR can't clear or plant another root's lock
        Sid      = "StateLock"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = [for key in var.state_keys : "${aws_s3_bucket.state.arn}/${key}.tflock"]
      },
      {
        # Bucket-level reads only (the bucket ARN, not its objects), for refreshing the state bucket's settings.
        # s3:Get* rather than a list so new provider versions reading new settings keep working.
        Sid      = "ReadStateBucketConfiguration"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:Get*"]
        Resource = aws_s3_bucket.state.arn
      },
      {
        Sid      = "ReadGitHubOidcProvider"
        Effect   = "Allow"
        Action   = "iam:GetOpenIDConnectProvider"
        Resource = local.github_oidc_provider_arn
      },
      {
        # This role and its inline policies, including the per-site grants
        Sid      = "ReadThisRole"
        Effect   = "Allow"
        Action   = ["iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"]
        Resource = aws_iam_role.plan.arn
      },
    ]
  })
}
