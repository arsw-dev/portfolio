module "site" {
  source = "./modules/static-site"

  name        = "arsw-portfolio"
  domains     = [var.domain, var.www_domain]
  bucket_name = var.bucket_name

  legacy_names = {
    origin_id       = "arsw-dev-portfolio-559401928721-us-east-1-an.s3.us-east-1.amazonaws.com-mqe4wkqyi1a"
    oac_name        = "oac-arsw-dev-portfolio-559401928721-us-east-1-an.s3.-mqe5al91h67"
    oac_description = "Created by CloudFront"
  }
}
