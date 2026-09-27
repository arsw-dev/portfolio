module "site" {
  source = "./modules/static-site"

  name        = "arsw-portfolio"
  domains     = [var.domain, var.www_domain]
  bucket_name = var.bucket_name
  github_repo = "arsw-dev/portfolio"

  # Created by infra/bootstrap (<name>-terraform-plan); the site grants it read on its own resources
  plan_role_name = "arsw-dev-terraform-plan"

  validation_record_fqdns = values(module.certificate_dns.record_names)
}

# Two calls, not one: the validation records must exist before the certificate is validated, and the domain
# records point at the distribution, which needs the validated certificate. One resource for both would be a cycle.

module "certificate_dns" {
  source = "./modules/cloudflare-dns"

  zone_id = var.cloudflare_zone_id
  records = {
    for domain, record in module.site.certificate_validation_records : domain => {
      name    = record.name
      type    = record.type
      content = record.value
    }
  }
}

module "site_dns" {
  source = "./modules/cloudflare-dns"

  zone_id = var.cloudflare_zone_id
  records = {
    for domain, record in module.site.domain_records : domain => {
      name    = record.name
      type    = record.type
      content = record.value
      # Proxied only so the Cloudflare www → apex redirect rule can run (moves into CloudFront in Phase 6)
      proxied = domain == var.www_domain
    }
  }
}
