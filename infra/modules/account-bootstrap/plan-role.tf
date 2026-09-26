# Read-only role for `terraform plan` on pull requests. It can read infrastructure and state,
# and write only the state lock file. It cannot change anything.

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

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadState"
        Effect   = "Allow"
        Action   = ["s3:ListBucket", "s3:GetObject"]
        Resource = [aws_s3_bucket.state.arn, "${aws_s3_bucket.state.arn}/*"]
      },
      {
        Sid      = "StateLock"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:DeleteObject"]
        Resource = "${aws_s3_bucket.state.arn}/*.tflock"
      },
      {
        Sid    = "ReadInfrastructure"
        Effect = "Allow"
        Action = [
          "acm:Describe*",
          "acm:List*",
          "cloudfront:Describe*",
          "cloudfront:Get*",
          "cloudfront:List*",
          "iam:GetOpenIDConnectProvider",
          "iam:GetPolicy",
          "iam:GetPolicyVersion",
          "iam:GetRole",
          "iam:GetRolePolicy",
          "iam:ListAttachedRolePolicies",
          "iam:ListInstanceProfilesForRole",
          "iam:ListRolePolicies",
          "s3:Get*",
          "s3:List*",
        ]
        Resource = "*"
      },
      {
        # s3:Get* above is for bucket configuration. Don't let it read object contents anywhere but the state bucket
        Sid         = "DenyObjectReadsOutsideState"
        Effect      = "Deny"
        Action      = "s3:GetObject*"
        NotResource = "${aws_s3_bucket.state.arn}/*"
      },
    ]
  })
}
