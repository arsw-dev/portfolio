output "cloudfront_domain" {
  description = "CloudFront distribution domain name"
  value       = module.site.distribution_domain
}

output "cloudfront_distribution_id" {
  description = "Distribution ID — used in GitHub Actions for cache invalidation"
  value       = module.site.distribution_id
}

output "s3_bucket_name" {
  description = "S3 bucket name — used in GitHub Actions for sync"
  value       = module.site.bucket_name
}

output "acm_certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.site.certificate_arn
}

output "deploy_role_arn" {
  description = "IAM role for the deploy workflow, referenced in deploy.yml"
  value       = module.site.deploy_role_arn
}
