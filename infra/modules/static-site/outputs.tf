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

# Both record outputs are maps keyed by domain. The keys are known at plan time even for a certificate that
# doesn't exist yet, so a DNS module can for_each over them in the same apply that requests the certificate.
# Names and values have ACM's trailing dots removed, matching what DNS providers (and their dashboards) store.

output "certificate_validation_records" {
  description = "Per domain, the DNS record that proves ownership so ACM can issue (and later renew) the certificate. Keep them in DNS permanently"
  value = {
    for domain in var.domains : domain => {
      name  = trimsuffix(local.validation_options[domain].resource_record_name, ".")
      type  = local.validation_options[domain].resource_record_type
      value = trimsuffix(local.validation_options[domain].resource_record_value, ".")
    }
  }
}

output "domain_records" {
  description = "Per domain, the DNS record pointing it at CloudFront. An apex domain needs CNAME flattening or an ALIAS/ANAME record"
  value = {
    for domain in var.domains : domain => {
      name  = domain
      type  = "CNAME"
      value = aws_cloudfront_distribution.this.domain_name
    }
  }
}

output "domains_attached" {
  description = "Whether the domains are attached to CloudFront (false while the certificate is being set up)"
  value       = local.attached
}

output "deploy_role_arn" {
  description = "IAM role assumed by the deploy workflow"
  value       = aws_iam_role.deploy.arn
}
