output "state_bucket_name" {
  description = "Terraform state bucket"
  value       = module.bootstrap.state_bucket_name
}

output "plan_role_arn" {
  description = "IAM role for the Terraform plan workflow, referenced in plan.yml"
  value       = module.bootstrap.plan_role_arn
}
