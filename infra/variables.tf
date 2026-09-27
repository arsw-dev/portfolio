variable "region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "S3 bucket name"
  type        = string
  default     = "arsw-dev-portfolio-559401928721-us-east-1-an"
}

variable "domain" {
  description = "Apex domain"
  type        = string
  default     = "arsw.dev"
}

variable "www_domain" {
  description = "www subdomain"
  type        = string
  default     = "www.arsw.dev"
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for arsw.dev"
  type        = string
  default     = "10db274d4ba15368f706a75491f1dab2"
}
