# CloudFront only reads certificates from us-east-1, so the caller's provider must be in us-east-1

resource "aws_acm_certificate" "this" {
  domain_name               = var.domains[0]
  subject_alternative_names = slice(var.domains, 1, length(var.domains))
  validation_method         = "DNS"
  tags                      = local.tags

  lifecycle {
    create_before_destroy = true
  }
}
