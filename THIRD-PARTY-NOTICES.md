# Third-party notices

Job Radar itself is MIT-licensed (see `LICENSE`). The components below are
third-party work with their own licenses and attribution requirements. Nothing
in `LICENSE` re-licenses them.

## Runtime and development dependencies

All direct dependencies are permissive. Versions are pinned in `package.json`
and `package-lock.json`.

| Package | Version | License |
| --- | --- | --- |
| `next` | 16.3.6 | MIT |
| `react`, `react-dom` | 19.3.0 | MIT |
| `@radix-ui/react-dialog` | 1.1.23 | MIT |
| `@radix-ui/react-slot` | 1.3.3 | MIT |
| `class-variance-authority` | 0.7.1 | Apache-2.0 |
| `clsx` | 2.1.1 | MIT |
| `lucide-react` | 1.48.0 | ISC |
| `nuqs` | 2.10.1 | MIT |
| `react-resizable-panels` | 4.14.1 | MIT |
| `server-only` | 0.0.1 | MIT |
| `tailwind-merge` | 3.7.0 | MIT |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | MIT |
| `typescript` | 5.9.3 | Apache-2.0 |
| `vitest` | 4.1.11 | MIT |
| `tsx` | 4.23.15 | MIT |
| `eslint`, `eslint-config-next` | 9.39.5 / 16.3.6 | MIT |
| `@electric-sql/pglite` | 0.5.8 | Apache-2.0 |
| `@types/node`, `@types/react`, `@types/react-dom` | 24.19.0 / 19.3.0 | MIT |
| `@ha7ch/job-pro` | 1.2.1 | MIT |

`@ha7ch/job-pro` (https://github.com/HA7CH/job-pro) is used strictly through its
public CLI process boundary. Its source is not vendored here; it is installed
from npm at a pinned version.

Apache-2.0 dependencies additionally require retention of any `NOTICE` file they
ship; those files remain inside the installed packages.

## Vendored material

- `scripts/ingest/vendor/jobhunter/` contains **only** the upstream license and a
  provenance notice for JobHunter (https://github.com/Bynlk/JobHunter, pinned at
  commit `4b5a69010a98b3d80b408fd983c1c2dfa60788e4`, MIT). No upstream source code
  is vendored; `scripts/ingest/ncss-adapter.py` is a local, reviewed adaptation
  whose provenance (original file SHA-256, removed/retained behaviours) is
  recorded in `NOTICE.md`.

## Brand and icon assets

- `public/brand/` — original Job Radar vector assets, covered by the project's
  MIT license.
- `public/company-marks/` — company marks derived from Simple Icons
  (https://simpleicons.org), released under **CC0 1.0**
  (`SIMPLE-ICONS-LICENSE.md`). Company names and logos remain trademarks of their
  owners and are used only to identify the employer of a listed position; see
  `SIMPLE-ICONS-DISCLAIMER.md`.

## Agent skills under `.agents/skills/`

Two third-party skill packs are retained, with their licenses and provenance:

| Skill | Upstream | License |
| --- | --- | --- |
| `hallmark` | Nutlope/hallmark @ `13ac0ec7e148655948100b6396439e481361d690` | MIT (`LICENSE` in tree) |
| `anti-ui-slop` | uizze/uizze @ `56f965dbd377dd73af256e0d3ded757d8747ed9d` | Apache-2.0 (`LICENSE` + `NOTICE` in tree) |

These are local development tooling only; nothing in the application imports
them at runtime.

**Not included in this repository:** two further skill packs whose
redistribution terms could not be established from their sources
(`visual-quality-final-audit`, `web-design-guidelines`). They were removed from
this repository's history rather than published under an unclear license.

## Job posting data

Public job listings and job descriptions quoted in reports, fixtures and
screenshots belong to the respective employers. They are included only as
evidence of ingestion and qualification behaviour, in minimal quantity, and are
not relicensed by this project. See `SECURITY.md` for the data-handling policy.
