# Runbook

How to operate the site's hosting when something goes wrong or needs changing. Commands assume the repo root, AWS credentials with admin rights on the account, and (for `infra/`) `CLOUDFLARE_API_TOKEN` set to a DNS:Edit token for the zone.

Names used below for this repo:

| Thing           | Value                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Site bucket     | `arsw-dev-portfolio-559401928721-us-east-1-an`                                                         |
| State bucket    | `arsw-dev-tfstate-559401928721-us-east-1`                                                              |
| Distribution    | `EO00233KMPD0C`                                                                                        |
| Terraform roots | `infra/` (state key `portfolio/terraform.tfstate`), `infra/bootstrap/` (`bootstrap/terraform.tfstate`) |

## Roll back a bad deploy

**Preferred: revert and merge.** Revert the bad change on a branch (`git revert <sha>`), open a PR, and merge once CI Result is green. The merge deploys the reverted code with the current deploy tool, and the smoke test confirms it's live.

**Faster: re-run an earlier Deploy.** In GitHub → Actions → Deploy, open the last good run and choose _Re-run all jobs_. It rebuilds and deploys _that run's commit_, using _that commit's_ `deploy.yml` and deploy tool. So only do this for runs recent enough to use the current deploy tool. An older run can bring back old deploy behaviour. The next merge to `main` deploys `main` again, so follow up with a revert anyway.

Either way, the previous build's hashed assets are still in the bucket (pruning keeps the last 3 builds and anything replaced within 7 days), so tabs open on any recent build keep working.

## Recover an overwritten or deleted file

The site bucket is versioned; old versions are kept for 7 days.

```sh
B=arsw-dev-portfolio-559401928721-us-east-1-an
aws s3api list-object-versions --bucket $B --prefix index.html \
  --query '{versions: Versions[].[VersionId, LastModified, IsLatest], deleted: DeleteMarkers[].[VersionId, LastModified]}'

# Restore a version by copying it over the current one
aws s3api copy-object --bucket $B --key index.html --copy-source "$B/index.html?versionId=<VersionId>"

# Make CloudFront pick it up (root files revalidate anyway; this is belt and braces)
aws cloudfront create-invalidation --distribution-id EO00233KMPD0C --paths "/*"
```

A file restored this way is replaced again by the next deploy if the build still contains a different version of it.

## Terraform says the state is locked

Terraform locks state with a file next to it (`<state key>.tflock`). A crashed or killed run can leave it behind, and every later plan or apply fails with "Error acquiring the state lock".

1. See who holds it:
   ```sh
   aws s3 cp s3://arsw-dev-tfstate-559401928721-us-east-1/portfolio/terraform.tfstate.tflock - | jq '{ID, Operation, Who, Created}'
   ```
2. Make sure that run is really over. `Who` like `runner@…` is a GitHub Actions run: check the Actions tab. Otherwise it's a laptop: check no `terraform` is still running there.
3. Remove it from the root that owns that state:
   ```sh
   cd infra            # or infra/bootstrap for bootstrap/terraform.tfstate
   terraform force-unlock <ID>
   ```

Never force-unlock a lock whose run might still be going. Two runs writing the same state can corrupt it.

## CI Plan fails on Cloudflare

- _"CLOUDFLARE_API_TOKEN is empty"_: the token must be a **repository** secret (Settings → Secrets and variables → Actions → Repository secrets). The Plan job doesn't run in the `production` environment, so environment secrets never reach it.
- _"Missing X-Auth-Key, X-Auth-Email or Authorization headers"_ locally: your shell doesn't have `CLOUDFLARE_API_TOKEN`. Open a new terminal or load it again.
- _Authentication errors with a token set_: the token may have expired or been rolled. CI's token needs DNS:Read on the zone; the local one needs DNS:Edit.

## Add another Terraform root

The CI plan role can only read and lock state files it's told about.

1. Pick the new root's backend key (for example `staging/terraform.tfstate`).
2. Add it to `state_keys` in `infra/bootstrap/main.tf` and apply `infra/bootstrap`.
3. If the root manages a site, pass `plan_role_name` to `static-site` so the plan role can read that site's resources.
4. Add plan steps for the root to `.github/workflows/ci.yml`.

Missing any of these shows up as `AccessDenied` in the PR's Plan job.

## Renaming or moving the GitHub repository

AWS trusts GitHub Actions by the repository's **name**: the roles accept tokens for `repo:arsw-dev/portfolio:pull_request` (plan) and `repo:arsw-dev/portfolio:environment:production` (deploy).

- **Rename or transfer:** GitHub redirects git traffic, but workflow tokens carry the new name, so both roles reject them. Update `github_repo` in `infra/main.tf` and `infra/bootstrap/main.tf` and apply both roots. Until then, CI plans and deploys fail with "Not authorized to perform sts:AssumeRoleWithWebIdentity".
- **Don't leave a trust pointing at a name you've given up.** If the old owner or repo name is freed and someone else registers it, their workflows would match the old trust. Update the trust as part of the rename, and never delete a GitHub org or account while AWS roles still trust its repos.
- **Custom OIDC subject claims:** if the org or repo customizes the OIDC `sub` claim template, token subjects change format and both trusts stop matching. Keep GitHub's default, or update the trust conditions to match.

## Upgrade Terraform

CI pins an exact Terraform version (`terraform_version` in `.github/workflows/ci.yml`) that must match the version used for local applies. Upgrade locally, then bump every `terraform_version` in the same PR.

## What's in the bucket

| Prefix          | What                                                                     | Managed by                                                                                               |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `assets/`       | Hashed build output, cached for a year                                   | Deploys upload; pruning deletes builds outside the last 3 that were replaced over 7 days ago             |
| `_deploys/`     | One record per deploy listing every file it uploaded; never served (404) | Deploys write them; kept as deploy history                                                               |
| everything else | `index.html` and files from `public/`, revalidated on every request      | Deploys upload; a file is deleted only if the previous deploy uploaded it and this build doesn't have it |

Files you place in the bucket by hand are never deleted by a deploy. The smoke test after each deploy checks the live site is the new build, every referenced asset and `.well-known` file is served correctly, missing files are 404, and build records aren't served.
