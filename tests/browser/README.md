# Task 7 Chrome acceptance

These are explicitly invoked live browser acceptance scripts, not offline unit tests.
They use the existing NCSS Playwright environment and installed Chrome; no browser dependency is added to the web app.

Start the production app at `http://127.0.0.1:3000` after `npm run build`:

```powershell
npm run start -- --hostname 127.0.0.1
.venv-ncss/Scripts/python.exe tests/browser/task7_acceptance.py
.venv-ncss/Scripts/python.exe tests/browser/task7_responsive.py
```

The acceptance snapshot is the eight Task 2/3 canonical jobs used on 2026-09-29, including the known vivo doctoral job. Changed live inventory may require updating these snapshot assertions; it must not be inserted into Supabase as test data.

The first script starts fresh local browser contexts, completes onboarding, verifies search/filter/sort/history/deep links, evidence/context, full detail, opens the actual public application URL (no form submission), changes the local profile, and verifies qualification again. It saves screenshots and results to ignored `.verification/`.

The responsive script tests 390/768/1100/1280/2560 widths. It changes only the browser's RSC response for NCSS's source-health status to simulate a failed source. It never updates source_runs/jobs in Supabase. All eight jobs remain browsable. Keyboard Enter/Escape, long real titles, full JD and mobile targets are exercised.

Offline, network-free tests remain `npm test` (including `tests/radar/` and the original domain/ingestion suites).

## M0 final acceptance additions

```powershell
.venv-ncss/Scripts/python.exe tests/browser/m0_profile.py
.venv-ncss/Scripts/python.exe tests/browser/m0_boundaries.py
```

`m0_profile.py` verifies local create/edit/reload, cross-tab changes, clear/cancel, unrelated storage preservation, corrupt/disabled storage and failed-write draft retention/retry. It uses isolated browser contexts.

`m0_boundaries.py` reads configured secret values in memory solely to check browser request/response exposure (never prints them). It then simulates an empty inventory and long evidence/JD **only in browser RSC responses**; those stress cases are not real upstream facts, are not final screenshots, and are never persisted. Production data and model pipelines are untouched. Live scripts require the existing local `.env.local`, Chrome and Python Playwright environment; they are not part of offline unit tests.

## Company brand asset pack

Run `.venv-ncss/Scripts/python.exe tests/browser/company_logo_integrity.py` against the production app. It verifies the same eight real jobs, five local brand images, Tencent fallback, failed-image fallback, no reserved brand requests, unchanged desktop/mobile sizes, and saves `docs/reports/assets/company-brand-asset-pack-v1/desktop-radar.png`. No production data is changed.
