# Offline tests for the account-bootstrap module. AWS is mocked, so these need no credentials and create nothing.

mock_provider "aws" {
  override_data {
    target = data.aws_caller_identity.current
    values = { account_id = "123456789012" }
  }

  mock_resource "aws_s3_bucket" {
    defaults = { arn = "arn:aws:s3:::acme-tfstate" }
  }

  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/acme-terraform-plan" }
  }
}

variables {
  name              = "acme"
  state_bucket_name = "acme-tfstate"
  github_repo       = "acme-co/site"
  state_keys        = ["bootstrap/terraform.tfstate", "site/terraform.tfstate"]
}

run "state_bucket_is_versioned_encrypted_and_private" {
  command = apply

  assert {
    condition     = aws_s3_bucket.state.bucket == "acme-tfstate"
    error_message = "The state bucket should use the given name."
  }

  assert {
    condition     = aws_s3_bucket_versioning.state.versioning_configuration[0].status == "Enabled"
    error_message = "State must be versioned so a bad write can be rolled back."
  }

  assert {
    condition     = one(aws_s3_bucket_server_side_encryption_configuration.state.rule).apply_server_side_encryption_by_default[0].sse_algorithm == "AES256"
    error_message = "State must be encrypted at rest."
  }

  assert {
    condition = alltrue([
      aws_s3_bucket_public_access_block.state.block_public_acls,
      aws_s3_bucket_public_access_block.state.block_public_policy,
      aws_s3_bucket_public_access_block.state.ignore_public_acls,
      aws_s3_bucket_public_access_block.state.restrict_public_buckets,
    ])
    error_message = "All public access to state should be blocked."
  }
}

run "creates_github_oidc_provider_by_default" {
  command = apply

  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 1
    error_message = "The OIDC provider should be created by default."
  }

  assert {
    condition     = aws_iam_openid_connect_provider.github[0].url == "https://token.actions.githubusercontent.com"
    error_message = "The provider should point at GitHub Actions."
  }

  assert {
    condition     = toset(aws_iam_openid_connect_provider.github[0].client_id_list) == toset(["sts.amazonaws.com"])
    error_message = "The provider's audience should be STS."
  }
}

run "reuses_an_existing_github_oidc_provider" {
  command = apply

  variables {
    create_github_oidc_provider = false
  }

  assert {
    condition     = length(aws_iam_openid_connect_provider.github) == 0
    error_message = "No provider should be created when the account already has one."
  }

  assert {
    condition     = jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Principal.Federated == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    error_message = "The plan role should still trust the account's existing provider."
  }

  assert {
    condition     = output.github_oidc_provider_arn == "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com"
    error_message = "The output should point at the existing provider."
  }
}

run "plan_role_trusts_only_pull_requests" {
  command = apply

  assert {
    condition     = aws_iam_role.plan.name == "acme-terraform-plan"
    error_message = "The plan role name should be <name>-terraform-plan."
  }

  assert {
    condition     = jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:acme-co/site:pull_request"
    error_message = "Only pull requests on the repo should be able to assume the plan role."
  }

  assert {
    condition     = length(keys(jsondecode(aws_iam_role.plan.assume_role_policy).Statement[0].Condition)) == 1
    error_message = "The trust policy should use exact matches only (no StringLike wildcards)."
  }
}

run "plan_role_cannot_change_anything_but_its_own_lock_files" {
  command = apply

  # Every Allow is a read, except the exact lock files
  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement : [
        for action in flatten([statement.Action]) :
        can(regex("^[a-z0-9-]+:(Get|List|Describe)", action))
      ] if statement.Sid != "StateLock"
    ]))
    error_message = "The plan role gained a write permission."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      statement.Sid == "StateLock" && toset(statement.Resource) == toset([
        "arn:aws:s3:::acme-tfstate/bootstrap/terraform.tfstate.tflock",
        "arn:aws:s3:::acme-tfstate/site/terraform.tfstate.tflock",
      ])
    ])
    error_message = "Lock writes should be limited to the exact lock files of the listed state keys."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      statement.Sid == "StateLock" && toset(statement.Action) == toset(["s3:GetObject", "s3:PutObject", "s3:DeleteObject"])
    ])
    error_message = "Taking and releasing a lock needs put, get (release checks the lock ID) and delete on the lock file."
  }

  assert {
    condition = anytrue([
      for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement :
      statement.Sid == "ReadState" && toset(statement.Resource) == toset([
        "arn:aws:s3:::acme-tfstate/bootstrap/terraform.tfstate",
        "arn:aws:s3:::acme-tfstate/site/terraform.tfstate",
      ])
    ])
    error_message = "State reads should be limited to the listed state keys."
  }
}

run "plan_role_reaches_nothing_outside_this_module" {
  command = apply

  assert {
    condition = alltrue(flatten([
      for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement : [
        for resource in flatten([statement.Resource]) : !strcontains(resource, "*")
      ]
    ]))
    error_message = "Every plan role permission should name exact resources; site resources are granted by each site."
  }

  assert {
    condition = toset(flatten([for statement in jsondecode(aws_iam_role_policy.plan.policy).Statement : statement.Resource])) == toset([
      "arn:aws:s3:::acme-tfstate",
      "arn:aws:s3:::acme-tfstate/bootstrap/terraform.tfstate",
      "arn:aws:s3:::acme-tfstate/site/terraform.tfstate",
      "arn:aws:s3:::acme-tfstate/bootstrap/terraform.tfstate.tflock",
      "arn:aws:s3:::acme-tfstate/site/terraform.tfstate.tflock",
      "arn:aws:iam::123456789012:oidc-provider/token.actions.githubusercontent.com",
      aws_iam_role.plan.arn,
    ])
    error_message = "The base policy should cover only state, the state bucket, the OIDC provider and this role."
  }

  assert {
    condition     = output.plan_role_name == "acme-terraform-plan"
    error_message = "plan_role_name should be output for sites to grant read access."
  }
}

run "state_keys_must_be_exact" {
  command = plan

  variables {
    state_keys = ["*"]
  }

  expect_failures = [var.state_keys]
}

run "old_state_versions_expire_but_recent_history_is_kept" {
  command = apply

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.state.rule[0].noncurrent_version_expiration[0].newer_noncurrent_versions == 5
    error_message = "The 5 most recent old versions of each state file should always be kept."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.state.rule[0].noncurrent_version_expiration[0].noncurrent_days == 30
    error_message = "Older state versions should expire after 30 days."
  }

  assert {
    condition     = aws_s3_bucket_lifecycle_configuration.state.rule[0].expiration[0].expired_object_delete_marker
    error_message = "Delete markers left by lock-file churn should be cleaned up."
  }
}
