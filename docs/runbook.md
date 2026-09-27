# Runbook

This site runs on [spa-platform](https://github.com/arsw-dev/spa-platform). Procedures live in its **[runbook](https://github.com/arsw-dev/spa-platform/blob/main/docs/runbook.md)**: rollback, restoring files, stuck state locks, Cloudflare token errors, the domain pre-flight, upgrading spa-platform, adding a Terraform root, and repository renames.

## This site's values

| Thing            | Value                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| AWS account      | `559401928721` (`us-east-1`)                                                                           |
| Site bucket      | `arsw-dev-portfolio-559401928721-us-east-1-an`                                                         |
| State bucket     | `arsw-dev-tfstate-559401928721-us-east-1`                                                              |
| Distribution     | `EO00233KMPD0C` (`d174s8ergdpv2r.cloudfront.net`)                                                      |
| Routing function | `arsw-portfolio-viewer-request`                                                                        |
| Terraform roots  | `infra/` (state key `portfolio/terraform.tfstate`), `infra/bootstrap/` (`bootstrap/terraform.tfstate`) |
| Cloudflare zone  | `10db274d4ba15368f706a75491f1dab2` (`arsw.dev`)                                                        |
| Plan role        | `arsw-dev-terraform-plan`                                                                              |
| Deploy role      | `arsw-portfolio-deploy`                                                                                |

## Differences from a template site

- **The state key** for the site root is `portfolio/terraform.tfstate`, not `site/terraform.tfstate`. The portfolio predates the template.
- **`www.arsw.dev` is proxied** in Cloudflare, only so a Cloudflare redirect rule can send it to `https://arsw.dev`. That rule is managed by hand in the Cloudflare dashboard, not in Terraform.
- **Only the four site records** in the zone are managed by Terraform. iCloud Mail (`arsw.dev`) and Email Routing (`alias.arsw.dev`) records are managed by hand.
- **`infra/bootstrap` also hosts spa-platform's release publishing:** the `arsw-dev-templates` bucket, and the `arsw-dev-spa-platform-release` role that only spa-platform's `v*` tags can use. Never enable account-level S3 Block Public Access: the published contractor-role templates must stay readable.
- **`arsw-dev-admin` can do nothing without MFA** (`infra/bootstrap/mfa.tf`), because this is the contractor account every client's `arsw-dev-contractor` role trusts. Its long-term key can only mint a session: run `pnpm --filter contractor mfa-session` in spa-platform once a day, then work as `AWS_PROFILE=arsw-mfa` (Terraform, the CLI, client profiles). A lost MFA device means recovering through the root user.
