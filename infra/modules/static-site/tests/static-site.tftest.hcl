# Offline tests for the static-site module. AWS is mocked, so these need no credentials and create nothing:
# `apply` runs against the mock, which fills computed attributes (ARNs, IDs) with the defaults below.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = data.aws_region.current
    values = { name = "us-east-1" }
  }

  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::mock-bucket" }
  }

  mock_resource "aws_cloudfront_distribution" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:distribution/EMOCK" }
  }

  mock_resource "aws_cloudfront_function" {
    defaults = { arn = "arn:aws:cloudfront::123456789012:function/mock" }
  }

  mock_resource "aws_acm_certificate" {
    defaults = { arn = "arn:aws:acm:us-east-1:123456789012:certificate/mock" }
  }
}

variables {
  name        = "acme"
  domains     = ["acme.com", "www.acme.com"]
  github_repo = "acme-co/site"
}

run "certificate_and_aliases_cover_all_domains" {
  command = apply

  assert {
    condition     = aws_acm_certificate.this.domain_name == "acme.com"
    error_message = "The first domain should be the certificate's primary name."
  }

  assert {
    condition     = toset(aws_acm_certificate.this.subject_alternative_names) == toset(["www.acme.com"])
    error_message = "The remaining domains should be certificate SANs."
  }

  assert {
    condition     = toset(aws_cloudfront_distribution.this.aliases) == toset(["acme.com", "www.acme.com"])
    error_message = "Every domain should be a CloudFront alias."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].acm_certificate_arn == aws_acm_certificate.this.arn
    error_message = "The distribution should use the module's certificate."
  }
}

run "single_domain_has_no_sans" {
  command = apply

  variables {
    domains = ["acme.com"]
  }

  assert {
    condition     = length(coalesce(aws_acm_certificate.this.subject_alternative_names, toset([]))) == 0
    error_message = "A single domain should produce no SANs."
  }
}

run "requires_a_domain" {
  command = plan

  variables {
    domains = []
  }

  expect_failures = [var.domains]
}

run "bucket_name_defaults_to_name_account_region" {
  command = apply

  assert {
    condition     = aws_s3_bucket.this.bucket == "acme-123456789012-us-east-1"
    error_message = "Default bucket name should be <name>-<account>-<region>."
  }
}

run "bucket_name_override" {
  command = apply

  variables {
    bucket_name = "legacy-bucket-name"
  }

  assert {
    condition     = aws_s3_bucket.this.bucket == "legacy-bucket-name"
    error_message = "bucket_name should override the default."
  }
}

run "bucket_is_private_and_only_readable_by_this_distribution" {
  command = apply

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.this.block_public_acls,
      aws_s3_bucket_public_access_block.this.block_public_policy,
      aws_s3_bucket_public_access_block.this.ignore_public_acls,
      aws_s3_bucket_public_access_block.this.restrict_public_buckets,
    ])
    error_message = "All public access should be blocked."
  }

  assert {
    condition     = jsondecode(aws_s3_bucket_policy.this.policy).Statement[0].Principal.Service == "cloudfront.amazonaws.com"
    error_message = "Only CloudFront should be granted read access."
  }

  assert {
    condition     = jsondecode(aws_s3_bucket_policy.this.policy).Statement[0].Action == "s3:GetObject"
    error_message = "CloudFront should only be able to read objects."
  }

  assert {
    condition     = jsondecode(aws_s3_bucket_policy.this.policy).Statement[0].Condition.ArnLike["AWS:SourceArn"] == aws_cloudfront_distribution.this.arn
    error_message = "Read access should be limited to this distribution."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.this.origin).origin_access_control_id == aws_cloudfront_origin_access_control.this.id
    error_message = "The origin should sign requests with the module's OAC."
  }
}

run "spa_routing_function_is_attached" {
  command = apply

  assert {
    condition     = aws_cloudfront_function.viewer_request.runtime == "cloudfront-js-2.0" && aws_cloudfront_function.viewer_request.publish
    error_message = "The routing function should be published on the cloudfront-js-2.0 runtime."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.this.default_cache_behavior[0].function_association).event_type == "viewer-request"
    error_message = "The routing function should run on viewer requests."
  }

  assert {
    condition     = one(aws_cloudfront_distribution.this.default_cache_behavior[0].function_association).function_arn == aws_cloudfront_function.viewer_request.arn
    error_message = "The distribution should use the module's routing function."
  }
}

run "https_security_headers_and_caching" {
  command = apply

  assert {
    condition     = aws_cloudfront_distribution.this.default_cache_behavior[0].viewer_protocol_policy == "redirect-to-https"
    error_message = "HTTP should redirect to HTTPS."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "TLS 1.2 should be the minimum."
  }

  assert {
    # Managed-SecurityHeadersPolicy
    condition     = aws_cloudfront_distribution.this.default_cache_behavior[0].response_headers_policy_id == "67f7725c-6f97-4210-82d7-5512b31e9d03"
    error_message = "The managed security headers policy should be attached."
  }

  assert {
    # Managed-CachingOptimized
    condition     = aws_cloudfront_distribution.this.default_cache_behavior[0].cache_policy_id == "658327ea-f89d-4fab-a63d-7e88639e58f6"
    error_message = "The managed CachingOptimized policy should be used."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.http_version == "http2and3" && aws_cloudfront_distribution.this.price_class == "PriceClass_All"
    error_message = "Defaults should be HTTP/2+3 and PriceClass_All."
  }
}

run "deploy_role_trusts_only_the_repo_environment" {
  command = apply

  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:acme-co/site:environment:production"
    error_message = "Only the repo's production environment should be able to assume the deploy role."
  }

  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:aud"] == "sts.amazonaws.com"
    error_message = "The token audience should be STS."
  }

  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    error_message = "The role should trust the account's GitHub OIDC provider."
  }

  assert {
    condition     = length(keys(jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition)) == 1
    error_message = "The trust policy should use exact matches only (no StringLike wildcards)."
  }
}

run "deploy_role_custom_environment" {
  command = apply

  variables {
    github_environment = "staging"
  }

  assert {
    condition     = jsondecode(aws_iam_role.deploy.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:acme-co/site:environment:staging"
    error_message = "github_environment should set the trusted environment."
  }
}

run "deploy_role_is_scoped_to_this_site" {
  command = apply

  assert {
    condition     = alltrue([for statement in jsondecode(aws_iam_role_policy.deploy.policy).Statement : statement.Resource != "*"])
    error_message = "No deploy permission should apply to all resources."
  }

  assert {
    condition = toset([for statement in jsondecode(aws_iam_role_policy.deploy.policy).Statement : statement.Resource]) == toset([
      aws_s3_bucket.this.arn,
      "${aws_s3_bucket.this.arn}/*",
      aws_cloudfront_distribution.this.arn,
    ])
    error_message = "Deploy permissions should cover only this bucket, its objects and this distribution."
  }

  assert {
    condition = toset(flatten([for statement in jsondecode(aws_iam_role_policy.deploy.policy).Statement : statement.Action])) == toset([
      "s3:ListBucket",
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "cloudfront:CreateInvalidation",
    ])
    error_message = "Deploy actions changed; update this test deliberately if that's intended."
  }
}

run "tags_merge_with_builtins_winning" {
  command = apply

  variables {
    tags = {
      team       = "web"
      managed_by = "someone-else"
    }
  }

  assert {
    condition = aws_s3_bucket.this.tags == tomap({
      Name       = "acme"
      site       = "acme"
      managed_by = "terraform"
      team       = "web"
    })
    error_message = "Extra tags should merge in, but Name/site/managed_by can't be overridden."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.tags == aws_s3_bucket.this.tags && aws_iam_role.deploy.tags == aws_s3_bucket.this.tags
    error_message = "Taggable resources should share the same tags."
  }
}
