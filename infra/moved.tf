# Resources moved into modules/static-site. Safe to delete once applied everywhere this state is used.

moved {
  from = aws_s3_bucket.portfolio
  to   = module.site.aws_s3_bucket.this
}

moved {
  from = aws_s3_bucket_public_access_block.portfolio
  to   = module.site.aws_s3_bucket_public_access_block.this
}

moved {
  from = aws_s3_bucket_policy.portfolio
  to   = module.site.aws_s3_bucket_policy.this
}

moved {
  from = aws_cloudfront_origin_access_control.portfolio
  to   = module.site.aws_cloudfront_origin_access_control.this
}

moved {
  from = aws_cloudfront_distribution.portfolio
  to   = module.site.aws_cloudfront_distribution.this
}

moved {
  from = aws_acm_certificate.portfolio
  to   = module.site.aws_acm_certificate.this
}
