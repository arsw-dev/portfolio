output "state_bucket_name" {
  description = "Terraform state bucket"
  value       = module.bootstrap.state_bucket_name
}

output "plan_role_arn" {
  description = "IAM role for the Terraform plan workflow, passed to site-ci.yml"
  value       = module.bootstrap.plan_role_arn
}

output "templates_bucket" {
  description = "Bucket spa-platform releases publish contractor-role templates to (spa-platform's TEMPLATES_BUCKET variable)"
  value       = aws_s3_bucket.templates.bucket
}

output "release_role_arn" {
  description = "Role spa-platform's release workflow assumes on v* tags (spa-platform's RELEASE_ROLE_ARN variable)"
  value       = aws_iam_role.release.arn
}
