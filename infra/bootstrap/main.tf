module "bootstrap" {
  source = "../modules/account-bootstrap"

  name              = "arsw-dev"
  state_bucket_name = "arsw-dev-tfstate-559401928721-us-east-1"
  github_repo       = "arsw-dev/portfolio"
}
