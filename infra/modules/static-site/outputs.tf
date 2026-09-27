output "bucket_name" {
  description = "S3 bucket holding the site files"
  value       = aws_s3_bucket.this.bucket
}

output "bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.this.arn
}

output "distribution_id" {
  description = "CloudFront distribution ID, used for cache invalidation"
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "CloudFront distribution ARN"
  value       = aws_cloudfront_distribution.this.arn
}

output "distribution_domain" {
  description = "CloudFront domain (*.cloudfront.net), also usable as a preview URL"
  value       = aws_cloudfront_distribution.this.domain_name
}

output "certificate_arn" {
  description = "ACM certificate ARN, or null when there are no domains"
  value       = local.has_domains ? aws_acm_certificate.this[0].arn : null
}

output "certificate_validation_records" {
  description = "DNS records that prove domain ownership so ACM can issue (and later renew) the certificate. Keep them in DNS permanently"
  value = local.has_domains ? distinct([
    for option in aws_acm_certificate.this[0].domain_validation_options : {
      name  = option.resource_record_name
      type  = option.resource_record_type
      value = option.resource_record_value
    }
  ]) : []
}

output "domain_records" {
  description = "DNS records pointing each domain at CloudFront. An apex domain needs CNAME flattening or an ALIAS/ANAME record"
  value = [
    for domain in var.domains : {
      name  = domain
      type  = "CNAME"
      value = aws_cloudfront_distribution.this.domain_name
    }
  ]
}

output "domains_attached" {
  description = "Whether the domains are attached to CloudFront (false while the certificate is being set up)"
  value       = local.attached
}

output "deploy_role_arn" {
  description = "IAM role assumed by the deploy workflow"
  value       = aws_iam_role.deploy.arn
}
