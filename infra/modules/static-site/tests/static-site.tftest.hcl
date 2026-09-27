# Offline tests for the static-site module. AWS is mocked, so these need no credentials and create nothing:
# `apply` runs against the mock, which fills computed attributes (ARNs, IDs) with the defaults below.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = data.aws_region.current
    values = { region = "us-east-1" }
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
    defaults = {
      arn = "arn:aws:acm:us-east-1:123456789012:certificate/mock"
      # ACM returns names and values with trailing dots; the module strips them
      domain_validation_options = [
        {
          domain_name           = "acme.com"
          resource_record_name  = "_abc.acme.com."
          resource_record_type  = "CNAME"
          resource_record_value = "_xyz.acm-validations.aws."
        },
        {
          domain_name           = "www.acme.com"
          resource_record_name  = "_def.www.acme.com."
          resource_record_type  = "CNAME"
          resource_record_value = "_uvw.acm-validations.aws."
        },
      ]
    }
  }
}

# Like the real provider: computed values (the certificate's validation options) stay unknown until apply
mock_provider "aws" {
  alias           = "unknown_until_apply"
  override_during = apply

  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  override_data {
    target = data.aws_region.current
    values = { region = "us-east-1" }
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
    condition     = aws_acm_certificate.this[0].domain_name == "acme.com"
    error_message = "The first domain should be the certificate's primary name."
  }

  assert {
    condition     = toset(aws_acm_certificate.this[0].subject_alternative_names) == toset(["www.acme.com"])
    error_message = "The remaining domains should be certificate SANs."
  }

  assert {
    condition     = toset(aws_cloudfront_distribution.this.aliases) == toset(["acme.com", "www.acme.com"])
    error_message = "Every domain should be a CloudFront alias."
  }

  assert {
    condition     = output.domains_attached
    error_message = "Domains should be attached by default."
  }
}

run "attached_certificate_goes_through_validation" {
  command = apply

  assert {
    condition     = length(aws_acm_certificate_validation.this) == 1 && aws_acm_certificate_validation.this[0].certificate_arn == aws_acm_certificate.this[0].arn
    error_message = "An attached certificate should be waited on until issued."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].acm_certificate_arn == aws_acm_certificate_validation.this[0].certificate_arn
    error_message = "The distribution should take the certificate from the validation step, never straight from the request."
  }

  assert {
    condition     = !aws_cloudfront_distribution.this.viewer_certificate[0].cloudfront_default_certificate && aws_cloudfront_distribution.this.viewer_certificate[0].minimum_protocol_version == "TLSv1.2_2021"
    error_message = "Custom domains should use the ACM certificate with TLS 1.2 minimum."
  }
}

run "single_domain_has_no_sans" {
  command = apply

  variables {
    domains = ["acme.com"]
  }

  assert {
    condition     = length(coalesce(aws_acm_certificate.this[0].subject_alternative_names, toset([]))) == 0
    error_message = "A single domain should produce no SANs."
  }
}

run "preview_mode_without_domains" {
  command = apply

  variables {
    domains = []
  }

  assert {
    condition     = length(aws_acm_certificate.this) == 0 && length(aws_acm_certificate_validation.this) == 0
    error_message = "No domains should mean no certificate."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.this.aliases) == 0
    error_message = "No domains should mean no aliases."
  }

  assert {
    condition     = aws_cloudfront_distribution.this.viewer_certificate[0].cloudfront_default_certificate
    error_message = "Preview mode should use the *.cloudfront.net default certificate."
  }

  assert {
    condition     = output.certificate_arn == null && length(output.certificate_validation_records) == 0 && length(output.domain_records) == 0
    error_message = "Preview mode should output no certificate or DNS records."
  }
}

run "requesting_a_certificate_without_attaching_leaves_the_site_alone" {
  command = apply

  variables {
    attach_domains = false
  }

  assert {
    condition     = length(aws_acm_certificate.this) == 1 && length(aws_acm_certificate_validation.this) == 0
    error_message = "The certificate should be requested but not waited on."
  }

  assert {
    condition     = length(aws_cloudfront_distribution.this.aliases) == 0 && aws_cloudfront_distribution.this.viewer_certificate[0].cloudfront_default_certificate
    error_message = "The distribution should stay on its preview address until domains are attached."
  }

  assert {
    # Compared as JSON: the output is a map of objects and the literal an object, which never compare equal
    condition = jsonencode(output.certificate_validation_records) == jsonencode({
      "acme.com"     = { name = "_abc.acme.com", type = "CNAME", value = "_xyz.acm-validations.aws" }
      "www.acme.com" = { name = "_def.www.acme.com", type = "CNAME", value = "_uvw.acm-validations.aws" }
    })
    error_message = "Each domain's validation record should be output, without ACM's trailing dots."
  }

  assert {
    condition     = keys(output.domain_records) == ["acme.com", "www.acme.com"] && alltrue([for record in values(output.domain_records) : record.value == aws_cloudfront_distribution.this.domain_name])
    error_message = "Each domain's CNAME target should be output."
  }

  assert {
    condition     = !output.domains_attached
    error_message = "domains_attached should report false."
  }
}

run "certificate_must_be_in_us_east_1" {
  command = plan

  override_data {
    target = data.aws_region.current
    values = { region = "eu-west-1" }
  }

  expect_failures = [aws_acm_certificate.this]
}

run "preview_mode_works_in_any_region" {
  command = plan

  override_data {
    target = data.aws_region.current
    values = { region = "eu-west-1" }
  }

  variables {
    domains = []
  }

  assert {
    condition     = length(aws_acm_certificate.this) == 0
    error_message = "Without a certificate the region doesn't matter."
  }
}

run "record_outputs_are_keyed_by_domain_before_the_certificate_exists" {
  # The certificate's validation options are unknown until it's requested, but a DNS module still needs the
  # keys to for_each over in the same apply
  command = plan

  providers = {
    aws = aws.unknown_until_apply
  }

  assert {
    condition     = keys(output.certificate_validation_records) == ["acme.com", "www.acme.com"]
    error_message = "Validation record keys should be the domains, known at plan time."
  }

  assert {
    condition     = keys(output.domain_records) == ["acme.com", "www.acme.com"]
    error_message = "Domain record keys should be the domains, known at plan time."
  }
}

run "validation_waits_for_records_the_caller_creates" {
  command = apply

  variables {
    validation_record_fqdns = ["_abc.acme.com", "_def.www.acme.com"]
  }

  assert {
    condition     = toset(aws_acm_certificate_validation.this[0].validation_record_fqdns) == toset(["_abc.acme.com", "_def.www.acme.com"])
    error_message = "Validation should be tied to the records the caller created."
  }
}

run "rejects_wildcard_domains" {
  command = plan

  variables {
    domains = ["acme.com", "*.acme.com"]
  }

  expect_failures = [var.domains]
}

run "rejects_duplicate_domains" {
  command = plan

  variables {
    domains = ["acme.com", "acme.com"]
  }

  expect_failures = [var.domains]
}

run "site_files_are_versioned_with_bounded_retention" {
  command = apply

  assert {
    condition     = aws_s3_bucket_versioning.this.versioning_configuration[0].status == "Enabled"
    error_message = "The site bucket should be versioned so deletes and bad deploys can be undone."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.this.rule[0].noncurrent_version_expiration[0].noncurrent_days == 7
    error_message = "Old versions should expire after 7 days by default."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.this.rule[0].expiration[0].expired_object_delete_marker
    error_message = "Leftover delete markers should be cleaned up."
  }
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
    condition = anytrue([
      for statement in jsondecode(aws_s3_bucket_policy.this.policy).Statement :
      statement.Action == "s3:ListBucket" && statement.Resource == aws_s3_bucket.this.arn && statement.Principal.Service == "cloudfront.amazonaws.com" && statement.Condition.ArnLike["AWS:SourceArn"] == aws_cloudfront_distribution.this.arn
    ])
    error_message = "CloudFront (this distribution only) should be able to list the bucket, so missing files return 404, not 403."
  }

  assert {
    condition     = length(jsondecode(aws_s3_bucket_policy.this.policy).Statement) == 2 && alltrue([for statement in jsondecode(aws_s3_bucket_policy.this.policy).Statement : statement.Principal.Service == "cloudfront.amazonaws.com"])
    error_message = "The bucket policy should grant only CloudFront, and only these two statements."
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

run "no_plan_role_grant_unless_asked" {
  command = apply

  assert {
    condition     = length(aws_iam_role_policy.plan_read) == 0
    error_message = "Without plan_role_name the module shouldn't touch any other role."
  }
}

run "plan_role_can_read_exactly_this_sites_resources" {
  command = apply

  variables {
    plan_role_name = "acme-terraform-plan"
  }

  assert {
    condition     = aws_iam_role_policy.plan_read[0].role == "acme-terraform-plan"
    error_message = "The grant should be attached to the named plan role."
  }

  assert {
    condition = toset(flatten([for statement in jsondecode(aws_iam_role_policy.plan_read[0].policy).Statement : statement.Resource])) == toset([
      aws_s3_bucket.this.arn,
      aws_cloudfront_distribution.this.arn,
      aws_cloudfront_function.viewer_request.arn,
      aws_cloudfront_origin_access_control.this.arn,
      aws_iam_role.deploy.arn,
      aws_acm_certificate.this[0].arn,
    ])
    error_message = "The grant should cover this site's bucket, distribution, function, OAC, deploy role and certificate, and nothing else."
  }

  assert {
    # The bucket ARN, never bucket/*: bucket settings are readable, file contents aren't
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.plan_read[0].policy).Statement : [
        for resource in flatten([statement.Resource]) : !strcontains(resource, "*")
      ]
    ]))
    error_message = "No grant should use a wildcard resource (including bucket/*)."
  }

  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.plan_read[0].policy).Statement : [
        for action in flatten([statement.Action]) :
        can(regex("^[a-z0-9-]+:(Get|List|Describe)", action)) || action == "cloudfront:TestFunction"
      ]
    ]))
    error_message = "The grant should be read-only (plus TestFunction, which executes and changes nothing)."
  }
}

run "plan_role_grant_in_preview_mode_has_no_certificate" {
  command = apply

  variables {
    plan_role_name = "acme-terraform-plan"
    domains        = []
  }

  assert {
    condition     = !anytrue([for statement in jsondecode(aws_iam_role_policy.plan_read[0].policy).Statement : statement.Sid == "ReadCertificate"])
    error_message = "Without domains there's no certificate to grant read on."
  }
}
