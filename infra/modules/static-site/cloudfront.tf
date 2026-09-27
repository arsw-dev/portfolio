resource "aws_cloudfront_origin_access_control" "this" {
  name                              = var.name
  description                       = "CloudFront access to the ${var.name} bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_function" "viewer_request" {
  name    = "${var.name}-viewer-request"
  runtime = "cloudfront-js-2.0"
  comment = "SPA routing for ${var.name}"
  publish = true
  code    = file("${path.module}/functions/viewer-request.js")
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  default_root_object = "index.html"
  aliases             = local.attached ? var.domains : []
  price_class         = var.price_class

  tags = local.tags

  origin {
    domain_name              = aws_s3_bucket.this.bucket_regional_domain_name
    origin_id                = local.origin_id
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = local.origin_id
    viewer_protocol_policy     = "redirect-to-https"
    compress                   = true
    cache_policy_id            = local.cache_policy_id
    response_headers_policy_id = local.response_headers_policy_id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.viewer_request.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # Custom domains use the validated ACM certificate. Otherwise the *.cloudfront.net default certificate, for which
  # CloudFront only accepts TLSv1 as the configured minimum (it's a temporary preview address).
  viewer_certificate {
    cloudfront_default_certificate = !local.attached
    acm_certificate_arn            = local.attached ? aws_acm_certificate_validation.this[0].certificate_arn : null
    ssl_support_method             = local.attached ? "sni-only" : null
    minimum_protocol_version       = local.attached ? "TLSv1.2_2021" : "TLSv1"
  }
}
