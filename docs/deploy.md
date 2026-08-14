# Deployment (CI)

How Caught Looking ships: **Cloud Run** for the Go API, **Cloudflare Pages** for the React SPA, driven by GitHub Actions.

**In plain English:** Push to `main` (with the right GitHub variables and secrets) builds the API image, deploys it, then publishes the website pointed at that API. Pull requests can get a Pages preview. You do not need this page to explore the live app or run locally.

Back to the [docs home](README.md) · [root README](../README.md) · [Configuration](configuration.md).

## What runs when

| Trigger | Workflow | What happens |
| --- | --- | --- |
| Push to **`main`** (or manual **Run workflow**) | [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) | Build/push API image → **Artifact Registry** → **Cloud Run** (HTTP startup probe **`GET /health`**); smoke **`GET /health`** + **`GET /ready`** on the new service URL (retries; fails the job before Pages); write Actions **job summaries** (SHA, image/API/Pages URLs, probe result); build SPA with **`VITE_API_BASE`** → **`frontend/dist`** to **Cloudflare Pages** ([`cloudflare/pages-action`](https://github.com/cloudflare/pages-action)); smoke **`GET /`** on the Pages deploy URL (retries; custom domain soft-check only) |
| Schedule (weekly) or manual | [`.github/workflows/weekly-probe-smoke.yml`](../.github/workflows/weekly-probe-smoke.yml) | Smoke **`GET /health`** + **`GET /ready`** against **`API_PUBLIC_URL`** (rare drift check; not a continuous uptime pinger) |
| Same-repo PR | [`.github/workflows/pages-preview.yml`](../.github/workflows/pages-preview.yml) | Same SPA build; **`VITE_API_BASE`** = live Cloud Run URL (`API_PUBLIC_URL`, or `gcloud` lookup) → branch preview (`https://<branch>.<project>.pages.dev`) |
| PR closed/merged | [`.github/workflows/pages-preview-cleanup.yml`](../.github/workflows/pages-preview-cleanup.yml) | Deletes that branch’s preview deployments (Cloudflare keeps them otherwise) |

Without **`VITE_API_BASE`**, the client falls back to same-origin **`/api`**, Pages serves `index.html`, and the UI shows a JSON parse error. Forks skip deploy jobs.

## Rollback (Cloud Run)

Images are tagged `api:<git-sha>`. To send **100%** traffic to a previous revision without rebuilding:

```bash
# List recent revisions (newest first)
gcloud run revisions list \
  --service "$CLOUDRUN_SERVICE_NAME" \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID"

# Route all traffic to a known-good revision
gcloud run services update-traffic "$CLOUDRUN_SERVICE_NAME" \
  --to-revisions=REVISION_NAME=100 \
  --region "$GCP_REGION" \
  --project "$GCP_PROJECT_ID"
```

SPA rollback: re-run **Deploy** on an older `main` commit, or upload a prior `frontend/dist` via Cloudflare Pages (Direct Upload). Prefer fixing forward on `main` when the bad change is small.

## Pages setup tips

| Prefer | Detail |
| :--- | :--- |
| Prefer | **Direct Upload** from Actions (empty Pages project is fine) |
| If Git-connected build also runs | Disable that build **or** set **`VITE_API_BASE`** in Cloudflare Pages **Preview** to the Cloud Run origin so native builds do not overwrite Actions previews |
| Security headers | Vite copies [`frontend/public/_headers`](../frontend/public/_headers) into `dist/` (CSP, nosniff, `X-Frame-Options`, referrer, Permissions-Policy). Keep `connect-src` aligned with `VITE_API_BASE` by **exact** Cloud Run hostname, not a `*.run.app` wildcard (that would allow connecting to any Cloud Run service, not just ours). Production and PR previews currently resolve to two different valid hostname aliases for the same service — legacy `<service>-<hash>-<region-code>.a.run.app` (production, `status.url` per `gcloud run services describe`) and modern `<service>-<hash>.<region>.run.app` (previews, via `API_PUBLIC_URL`) — both must stay listed until that's consolidated |

## One-time Google Cloud setup

1. Enable billing, **Cloud Run**, **Artifact Registry**, and optionally **Cloud Build** (not required for this workflow’s Docker build in Actions). Create a **billing budget + email alert** (notify-only is enough) so spend surprises are visible while staying on scale-to-zero defaults.
2. Create a **Docker** Artifact Registry repository (name matching `GCP_ARTIFACT_REPOSITORY`).
3. Create a **deploy service account** with at least:
   - **Artifact Registry Repository Administrator** (push images + cleanup policies)
   - **Cloud Run Admin**
   - **Service Account User** (on the Cloud Run runtime SA if prompted)
4. Do **not** create a JSON key for CI. If the SA only has **Artifact Registry Writer**, upgrade to **Repository Administrator** (or grant `artifactregistry.repositories.update`) so cleanup-policy can run.
5. Configure **Workload Identity Federation** so this repo’s GitHub Actions principal can impersonate the deploy SA. Store:
   - Provider → `GCP_WORKLOAD_IDENTITY_PROVIDER`
   - SA email → `GCP_DEPLOY_SERVICE_ACCOUNT`

## One-time Cloudflare setup

1. Create a **Pages** project whose name matches **`CLOUDFLARE_PAGES_PROJECT_NAME`** (can be empty; Actions uploads the build).
2. Create a least-privilege **API token**: **Account → Cloudflare Pages → Edit** (and **Account → Read** if required). Rotate periodically.
3. Store **`CLOUDFLARE_API_TOKEN`** and **`CLOUDFLARE_ACCOUNT_ID`** as repository secrets.

## GitHub repository variables

| Variable                        | Example                          | Purpose                                                                                        |
| ------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `GCP_PROJECT_ID`                | `my-gcp-project`                 | GCP project id                                                                                 |
| `GCP_REGION`                    | `us-central1`                    | Cloud Run and Artifact Registry region                                                         |
| `GCP_ARTIFACT_REPOSITORY`       | `caught-looking`                 | Artifact Registry repo name (image: `…/api:<git-sha>`)                                         |
| `CLOUDRUN_SERVICE_NAME`         | `caught-looking-api`             | Cloud Run service name                                                                         |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | `projects/123/locations/global/workloadIdentityPools/github/providers/caught-looking` | Workload Identity Federation provider resource name for GitHub Actions |
| `GCP_DEPLOY_SERVICE_ACCOUNT`    | `gha-deploy@my-gcp-project.iam.gserviceaccount.com` | Deploy service account email impersonated by GitHub Actions                                    |
| `CLOUDRUN_MAX_INSTANCES`        | `2`                              | Optional. Cloud Run max instances (default **`2`**). Caps worst-case request spend.            |
| `CLOUDRUN_MIN_INSTANCES`        | `0`                              | Optional. Cloud Run min instances (default **`0`**, scale-to-zero when idle).                  |
| `GCP_ARTIFACT_KEEP_COUNT`       | `5`                              | Optional. Artifact Registry versions to keep per package (default **`5`**); older images are deleted by the cleanup policy. |
| `CORS_ALLOWED_ORIGINS` | `https://caught-looking.com,https://www.caught-looking.com` | API `ALLOWED_ORIGINS` (apex + `www`). Deploy also appends `https://<project>.pages.dev` and `https://*.<project>.pages.dev` when `CLOUDFLARE_PAGES_PROJECT_NAME` is set. |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | `your-project` | If **unset**, only the API deploy runs |
| `SITE_PUBLIC_URL` | `https://caught-looking.com` | Optional. Soft-checked after Pages publish (warn-only). Hard smoke uses the Pages action URL / `*.pages.dev` because custom domains often return **403** from Actions (`cf-mitigated: challenge`). Safe to leave set for docs; unset if you do not want the soft check |
| `API_PUBLIC_URL` | `https://….run.app` | Cloud Run origin (no trailing slash). Used for PR preview builds when set (else preview looks it up via `gcloud`), and required by [weekly probe smoke](../.github/workflows/weekly-probe-smoke.yml) |

## GitHub repository secrets

| Secret                  | Purpose                      |
| ----------------------- | ---------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token         |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id        |

## After the first successful deploy

| Check | Detail |
| :--- | :--- |
| **CORS** | `CORS_ALLOWED_ORIGINS` must include real SPA origins (`https://caught-looking.com`, `https://www.caught-looking.com`). Pages + branch-preview origins are appended from `CLOUDFLARE_PAGES_PROJECT_NAME`. Custom domains → update the variable and push to `main` (or patch Cloud Run env). |
| **Cost / abuse** | Deploy uses `--min-instances=0`, `--max-instances=2` (override via vars above). Artifact Registry cleanup keeps `GCP_ARTIFACT_KEEP_COUNT` newest versions (~daily). API still has per-IP limits + outbound QPS caps. See [Cost and scale tradeoffs](../README.md#cost-and-scale-tradeoffs). **Confirm** a GCP [billing budget + alert](https://cloud.google.com/billing/docs/how-to/budgets) is configured (email notify-only is fine — no auto-shutdown required for `$0` intent). |
| **Alerting** | `GET /metrics` is scrape-it-yourself only (see [SLOs](slo.md)) — nothing watches production by default. **Set up** a free Cloud Monitoring uptime check on `/health` + an email alert policy once the Cloud Run URL exists; see [Production alerting](slo.md#production-alerting-free-tier) for the exact steps and what's deliberately skipped. |
