module "bootstrap" {
  source = "../modules/account-bootstrap"

  name              = "arsw-dev"
  state_bucket_name = "arsw-dev-tfstate-559401928721-us-east-1"
  github_repo       = "arsw-dev/portfolio"

  # One per Terraform root in this account; the plan role can read and lock only these
  state_keys = [
    "bootstrap/terraform.tfstate",
    "portfolio/terraform.tfstate",
  ]
}
