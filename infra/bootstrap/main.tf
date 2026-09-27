module "bootstrap" {
  source = "github.com/arsw-dev/spa-platform//modules/account-bootstrap?ref=v1.0.0-rc.2"

  name              = "arsw-dev"
  state_bucket_name = "arsw-dev-tfstate-559401928721-us-east-1"
  github_repo       = "arsw-dev/portfolio"

  # One per Terraform root in this account; the plan role can read only these
  state_keys = [
    "bootstrap/terraform.tfstate",
    "portfolio/terraform.tfstate",
  ]
}
