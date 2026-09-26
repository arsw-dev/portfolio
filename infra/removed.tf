# The OIDC provider is now managed by bootstrap/. Forget it here without destroying it.
# Safe to delete once applied.

removed {
  from = aws_iam_openid_connect_provider.github

  lifecycle {
    destroy = false
  }
}
