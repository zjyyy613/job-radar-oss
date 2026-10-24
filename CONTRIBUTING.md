# Contributing

Thanks for taking a look. This is a single-maintainer project, so the most
useful contributions are focused fixes with tests rather than large,
unrequested refactors.

## Getting started without any credentials

You do **not** need Supabase or a model API key to work on most of this
repository.

```sh
npm ci
npm run lint
npm run typecheck
npm test
```

`npm test` runs the offline suite (574 specs at the time of writing) and needs
Node 24; it also runs the NCSS Python standard-library tests, so a Python 3.13
interpreter must be available (`py -3` on Windows, `python3` elsewhere, or set
`NCSS_PYTHON` to an absolute path). Playwright is **not** required for tests.

The deterministic qualification engine, canonicalisation, category rules, the
ingestion contracts and the candidate/refresh audits all run offline. Only
`/radar` needs a populated database:

```sh
cp .env.example .env.local   # fill in only if you want to read a real database
npm run dev
```

Guest profile, onboarding, saved jobs and preferences work locally in the
browser with no server configuration.

## Expectations for a pull request

1. **Keep the frozen contracts frozen.** Qualification, gate/evidence semantics
   and the admission contract are intentionally strict; a change that relaxes
   them needs a written rationale, not just green tests.
2. **Add a test for behaviour you change.** `tests/` is the contract: prefer a
   failing test first. New ingestion sources require a real captured fixture plus
   an admission test.
3. **No new runtime dependency without justification.** The runtime surface is
   deliberately small (see `THIRD-PARTY-NOTICES.md`).
4. **Do not weaken safety defaults**: conservative `unknown` states, "partial is
   not success", and budget caps exist on purpose.
5. `npm run lint` must report zero warnings (`--max-warnings=0`).

## Never commit

Real credentials, `.env.local`, production exports, or personal data. If you
believe a secret was committed, follow `SECURITY.md` instead of opening an issue.

## Licensing of contributions

By opening a pull request you agree that your contribution is licensed under the
repository's MIT license (`LICENSE`).

## Reporting something that is not a bug

Data-quality observations ("this source returns placeholder locations", "this
title is miscategorised") are welcome — include the source, a sample title and
the expected category, and please do not paste full job descriptions.
