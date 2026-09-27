output "record_names" {
  description = "Record names by key. Referencing these orders anything that needs the records to exist (such as certificate validation) after they're created"
  value       = { for key, record in cloudflare_dns_record.this : key => record.name }
}
