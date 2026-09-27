variable "zone_id" {
  description = "Cloudflare zone ID (the zone's overview page, not secret)"
  type        = string
}

variable "records" {
  description = "Records to manage, keyed by a stable name the caller chooses (for example the domain). Keys must be known at plan time; values may not be. One record per key: this module doesn't handle multi-value records such as several MX entries"
  type = map(object({
    name    = string
    type    = string
    content = string
    proxied = optional(bool, false)
    ttl     = optional(number, 1)
  }))

  validation {
    condition     = alltrue([for record in values(var.records) : !record.proxied || record.ttl == 1])
    error_message = "Proxied records must use ttl = 1 (automatic); Cloudflare ignores any other TTL for them."
  }
}
