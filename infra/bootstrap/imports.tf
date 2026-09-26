# The state bucket was created by hand and the OIDC provider was previously managed in ../ci.tf.
# Safe to delete once applied.

import {
  to = module.bootstrap.aws_s3_bucket.state
  id = "arsw-dev-tfstate-559401928721-us-east-1"
}

import {
  to = module.bootstrap.aws_s3_bucket_versioning.state
  id = "arsw-dev-tfstate-559401928721-us-east-1"
}

import {
  to = module.bootstrap.aws_s3_bucket_server_side_encryption_configuration.state
  id = "arsw-dev-tfstate-559401928721-us-east-1"
}

import {
  to = module.bootstrap.aws_s3_bucket_public_access_block.state
  id = "arsw-dev-tfstate-559401928721-us-east-1"
}

import {
  to = module.bootstrap.aws_iam_openid_connect_provider.github[0]
  id = "arn:aws:iam::559401928721:oidc-provider/token.actions.githubusercontent.com"
}
