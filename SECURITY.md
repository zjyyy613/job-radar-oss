# Security policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's
private vulnerability reporting on this repository ("Security" tab → "Report a
vulnerability"). If that is unavailable, contact the maintainer through the
GitHub profile linked in `package.json`.

Include: affected version/commit, reproduction steps, and impact. Please do not
include real credentials, production data, or personal information in a report.

Expect an acknowledgement within a few days. This is a single-maintainer
project; there is no paid support or SLA.

## What must never be published

- Supabase service-role / secret keys, DeepSeek API keys, or any `sb_secret_` /
  `sk-` value.
- Real user profile data. Profiles are stored in the browser only; nothing in
  this repository contains a real person's name, phone number, or email address.
- Production database exports or full scraped corpora.

## How this repository handles secrets

- Configuration is read from the environment on the server only
  (`SUPABASE_URL`, `SUPABASE_SECRET_KEY` or the legacy
  `SUPABASE_SERVICE_ROLE_KEY`, `DEEPSEEK_API_KEY`).
- `.env*` is git-ignored; only `.env.example` with empty placeholders is
  committed.
- No credential is ever exposed with a `NEXT_PUBLIC_` prefix, forwarded to the
  `job-pro` child process, written to logs, or included in error messages.
- CI in this repository uses **no secrets at all**, so a fork runs the same
  checks with no access to any production system.

## Automation boundaries

Collection and refresh workflows are `workflow_dispatch`-only in this
repository and are **not** scheduled. They require owner-provided secrets that
do not exist in a fork, and they are documented here rather than intended for
contributor use. Only CI (`ci.yml`) and the read-only candidate audit
(`candidate-audit.yml`) run automatically or on demand for contributors.

## Supported versions

The `main` development line only. There are no maintained release branches yet.
