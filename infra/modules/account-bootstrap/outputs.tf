output "state_bucket_name" {
  description = "Terraform state bucket"
  value       = aws_s3_bucket.state.bucket
}

output "github_oidc_provider_arn" {
  description = "GitHub Actions OIDC provider ARN (created here or pre-existing)"
  value       = local.github_oidc_provider_arn
}

output "plan_role_arn" {
  description = "Role assumed by the Terraform plan workflow on pull requests"
  value       = aws_iam_role.plan.arn
}
