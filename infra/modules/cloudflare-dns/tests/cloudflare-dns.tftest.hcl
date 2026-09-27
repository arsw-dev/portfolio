# Offline tests for the cloudflare-dns module. Cloudflare is mocked, so these need no token and change nothing.

mock_provider "cloudflare" {}

variables {
  zone_id = "0123456789abcdef0123456789abcdef"
  records = {
    "acme.com" = {
      name    = "acme.com"
      type    = "CNAME"
      content = "d111111abcdef8.cloudfront.net"
    }
    "www.acme.com" = {
      name    = "www.acme.com"
      type    = "CNAME"
      content = "d111111abcdef8.cloudfront.net"
      proxied = true
    }
  }
}

run "creates_one_record_per_key_in_the_zone" {
  command = apply

  assert {
    condition     = length(cloudflare_dns_record.this) == 2 && alltrue([for record in values(cloudflare_dns_record.this) : record.zone_id == var.zone_id])
    error_message = "Each record should be created in the given zone."
  }

  assert {
    condition     = cloudflare_dns_record.this["acme.com"].content == "d111111abcdef8.cloudfront.net" && cloudflare_dns_record.this["acme.com"].type == "CNAME"
    error_message = "Records should carry their type and content."
  }
}

run "records_are_dns_only_unless_asked" {
  command = apply

  assert {
    condition     = cloudflare_dns_record.this["acme.com"].proxied == false
    error_message = "Records should default to DNS-only: proxying would put Cloudflare in front of CloudFront."
  }

  assert {
    condition     = cloudflare_dns_record.this["www.acme.com"].proxied == true
    error_message = "proxied = true should be passed through."
  }

  assert {
    condition     = alltrue([for record in values(cloudflare_dns_record.this) : record.ttl == 1])
    error_message = "TTL should default to 1 (automatic)."
  }
}

run "outputs_names_by_key" {
  command = apply

  assert {
    condition     = jsonencode(output.record_names) == jsonencode({ "acme.com" = "acme.com", "www.acme.com" = "www.acme.com" })
    error_message = "record_names should map each key to its record name."
  }
}

run "proxied_records_must_use_automatic_ttl" {
  command = plan

  variables {
    records = {
      "www.acme.com" = {
        name    = "www.acme.com"
        type    = "CNAME"
        content = "d111111abcdef8.cloudfront.net"
        proxied = true
        ttl     = 300
      }
    }
  }

  expect_failures = [var.records]
}
