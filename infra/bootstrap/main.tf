module "bootstrap" {
  source = "github.com/arsw-dev/spa-platform//modules/account-bootstrap?ref=d5b9555b177a64d06a5fe68cfae86c960e667fe0"

  name              = "arsw-dev"
  state_bucket_name = "arsw-dev-tfstate-559401928721-us-east-1"
  github_repo       = "arsw-dev/portfolio"

  # One per Terraform root in this account; the plan role can read and lock only these
  state_keys = [
    "bootstrap/terraform.tfstate",
    "portfolio/terraform.tfstate",
  ]
}
