# Certificate for var.domains. Created whenever there are domains; attached to CloudFront only once validated
# and attach_domains is true (see cloudfront.tf). With no domains the site runs on the CloudFront default
# certificate at its *.cloudfront.net address.

resource "aws_acm_certificate" "this" {
  count = local.has_domains ? 1 : 0

  domain_name               = var.domains[0]
  subject_alternative_names = slice(var.domains, 1, length(var.domains))
  validation_method         = "DNS"
  tags                      = local.tags

  lifecycle {
    create_before_destroy = true

    precondition {
      condition     = data.aws_region.current.name == "us-east-1"
      error_message = "CloudFront only uses ACM certificates from us-east-1, but this module's AWS provider is in ${data.aws_region.current.name}. Configure the provider passed to static-site for us-east-1."
    }
  }
}

# Waits until the certificate is issued, which needs the records in the certificate_validation_records output
# to exist in DNS. The distribution uses this resource's certificate_arn, so it never receives a certificate
# that CloudFront would reject as pending.
resource "aws_acm_certificate_validation" "this" {
  count = local.attached ? 1 : 0

  certificate_arn = aws_acm_certificate.this[0].arn
}

moved {
  from = aws_acm_certificate.this
  to   = aws_acm_certificate.this[0]
}
