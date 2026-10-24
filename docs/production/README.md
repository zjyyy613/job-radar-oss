# Production pipeline (reference only — not active here)

The two YAML files in this directory are the production ingestion pipeline of the
**private** upstream repository, kept here as reviewable documentation.

They are deliberately **outside `.github/workflows/`**, so GitHub Actions cannot
run them in this repository. They require owner-held secrets
(`SUPABASE_URL`, `SUPABASE_SECRET_KEY`, legacy `SUPABASE_SERVICE_ROLE_KEY`,
`DEEPSEEK_API_KEY`) and they write to a live database; neither exists in a fork.

Also note that the scheduled trigger (`cron`) has been removed even from these
copies. If this pipeline is ever mirrored back into `.github/workflows/`, it must
stay manual-only.

| File | Role |
| --- | --- |
| `refresh.yml` | Daily incremental refresh: bounded ingestion → canonicalisation → pending-only gate extraction, with a checkpoint/summary artifact and a post-run audit step. |
| `ingest-ncss.yml` | Bounded NCSS-only ingestion (public employment platform) using a Playwright session; manual, single-page. |

What remains active in `.github/workflows/`:

- `ci.yml` — lint, typecheck, tests, production build, NCSS python tests. No secrets.
- `candidate-audit.yml` — manual, read-only candidate audit. No secrets, no database,
  no model calls; it only reports on public job listings.

The local equivalents are runnable without any credential:

```sh
npm run ingest:job-pro -- --dry-run --sources jd --scope intern --limit 2
node --import tsx scripts/ingest/candidate-audit.ts --sources jd --scope intern \
  --start-page 1 --page-size 2 --max-pages 1 --max-jobs 2 --global-max-jobs 2 --out .verification/audit
```
