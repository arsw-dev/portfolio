# The four site records were created by hand in the Cloudflare dashboard. Safe to delete once applied.
# Other records in the zone (iCloud Mail, Email Routing on alias.arsw.dev) are deliberately not managed here.

import {
  to = module.certificate_dns.cloudflare_dns_record.this["arsw.dev"]
  id = "10db274d4ba15368f706a75491f1dab2/a0fb79d5a8e8d346208baf89e0acac11"
}

import {
  to = module.certificate_dns.cloudflare_dns_record.this["www.arsw.dev"]
  id = "10db274d4ba15368f706a75491f1dab2/5f74100917d112998540390ca7220d3a"
}

import {
  to = module.site_dns.cloudflare_dns_record.this["arsw.dev"]
  id = "10db274d4ba15368f706a75491f1dab2/fe451ca76985adb34fb2a72468d414b5"
}

import {
  to = module.site_dns.cloudflare_dns_record.this["www.arsw.dev"]
  id = "10db274d4ba15368f706a75491f1dab2/498176ebc48b35d34a0806dec682aa7d"
}
