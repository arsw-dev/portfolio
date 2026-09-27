# Read access for the account's Terraform plan role (account-bootstrap), limited to this site's own resources by
# exact ARN, so pull-request plans can refresh them without the role reaching anything else in the account.
# Actions match what plans were observed calling (CloudTrail). Skipped when plan_role_name is null.

resource "aws_iam_role_policy" "plan_read" {
  count = var.plan_role_name == null ? 0 : 1

  name = "${var.name}-plan-read"
  role = var.plan_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          # Bucket-level reads only (the bucket ARN, not its objects). s3:Get* rather than a list so new provider
          # versions reading new bucket settings keep working; it can't read any file.
          Sid      = "ReadBucketConfiguration"
          Effect   = "Allow"
          Action   = ["s3:ListBucket", "s3:Get*"]
          Resource = aws_s3_bucket.this.arn
        },
        {
          Sid    = "ReadCloudFront"
          Effect = "Allow"
          Action = [
            "cloudfront:DescribeFunction",
            "cloudfront:GetDistribution",
            "cloudfront:GetFunction",
            "cloudfront:GetOriginAccessControl",
            "cloudfront:ListTagsForResource",
          ]
          Resource = [
            aws_cloudfront_distribution.this.arn,
            aws_cloudfront_function.viewer_request.arn,
            aws_cloudfront_origin_access_control.this.arn,
          ]
        },
        {
          # Runs the routing function against sample events (functions/test-live.sh). Executes code, changes nothing
          Sid      = "TestRoutingFunction"
          Effect   = "Allow"
          Action   = "cloudfront:TestFunction"
          Resource = aws_cloudfront_function.viewer_request.arn
        },
        {
          Sid      = "ReadDeployRole"
          Effect   = "Allow"
          Action   = ["iam:GetRole", "iam:GetRolePolicy", "iam:ListRolePolicies", "iam:ListAttachedRolePolicies"]
          Resource = aws_iam_role.deploy.arn
        },
      ],
      local.has_domains ? [
        {
          Sid      = "ReadCertificate"
          Effect   = "Allow"
          Action   = ["acm:DescribeCertificate", "acm:ListTagsForCertificate"]
          Resource = aws_acm_certificate.this[0].arn
        },
      ] : [],
    )
  })
}
