module "site" {
  source = "./modules/static-site"

  name        = "arsw-portfolio"
  domains     = [var.domain, var.www_domain]
  bucket_name = var.bucket_name
}
