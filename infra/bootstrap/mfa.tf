# Every client's arsw-dev-contractor role trusts this account for callers with a recent MFA sign-in, so MFA here must
# be unskippable: without this, arsw-dev-admin's long-term key alone could enrol a new MFA device and reach every client.
# The key can only mint an MFA session (spa-platform: `pnpm --filter contractor mfa-session`); everything else,
# including Terraform, runs from that session's arsw-mfa profile. MFA device management isn't exempt on purpose.
# Losing the MFA device means recovering through the root user.

locals {
  admin_user = "arsw-dev-admin"
}

data "aws_iam_user" "admin" {
  user_name = local.admin_user
}

resource "aws_iam_user_policy" "require_mfa" {
  name = "require-mfa"
  user = data.aws_iam_user.admin.user_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyAllWithoutMfa"
        Effect    = "Deny"
        NotAction = "sts:GetSessionToken"
        Resource  = "*"
        # IfExists: long-term key calls carry no MFA key at all, and must be denied too
        Condition = { BoolIfExists = { "aws:MultiFactorAuthPresent" = "false" } }
      },
    ]
  })
}

# PR plans must be able to refresh the user and its policy, like each site's plan_read grant
resource "aws_iam_role_policy" "plan_read_admin_mfa" {
  name = "arsw-dev-admin-mfa-plan-read"
  role = module.bootstrap.plan_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadAdminUserAndPolicy"
        Effect   = "Allow"
        Action   = ["iam:GetUser", "iam:GetUserPolicy"]
        Resource = data.aws_iam_user.admin.arn
      },
    ]
  })
}
