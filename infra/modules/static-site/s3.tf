resource "aws_s3_bucket" "this" {
  bucket = local.bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "this" {
  bucket = aws_s3_bucket.this.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_policy" "this" {
  bucket = aws_s3_bucket.this.id

  policy = jsonencode({
    Id      = "PolicyForCloudFrontPrivateContent"
    Version = "2008-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.this.arn}/*"
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
          }
        }
      },
      {
        # Without ListBucket, S3 answers a missing key with 403, so missing files looked "forbidden" rather than
        # "not found". Only CloudFront, only for this distribution; viewers can't list the bucket through it
        # because the routing function turns / into /index.html and query strings aren't forwarded.
        # That makes this safe only while EVERY cache behaviour on this origin runs the routing function: a
        # behaviour without it would expose a full bucket listing at its path.
        Sid       = "AllowCloudFrontToReportMissingFiles"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:ListBucket"
        Resource  = aws_s3_bucket.this.arn
        Condition = {
          ArnLike = {
            "AWS:SourceArn" = aws_cloudfront_distribution.this.arn
          }
        }
      },
      {
        # Build records are deploy bookkeeping. The routing function answers /_deploys/ with 404, but URL
        # encodings (/%5Fdeploys/…) reach S3 decoded; denying CloudFront the keys holds however the path is written.
        # The deploy role (an IAM principal, not this service principal) is unaffected.
        Sid       = "DenyCloudFrontBuildRecords"
        Effect    = "Deny"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.this.arn}/_deploys/*"
      },
    ]
  })
}

# Versioning keeps overwritten and deleted files recoverable for noncurrent_version_retention_days, so a bad
# deploy or a mistaken delete can be undone
resource "aws_s3_bucket_versioning" "this" {
  bucket = aws_s3_bucket.this.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "this" {
  bucket = aws_s3_bucket.this.id

  rule {
    id     = "expire-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = var.noncurrent_version_retention_days
    }

    expiration {
      expired_object_delete_marker = true
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }

  depends_on = [aws_s3_bucket_versioning.this]
}
