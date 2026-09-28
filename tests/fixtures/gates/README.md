# Task 5 regression corpus

Source: user-designated `C:\Users\zhang\job-radar-spike`, read on 2026-09-29 (Asia/Shanghai).

- `spike-sample-6.json`: unchanged copy of `data/sample-6.json`, six real Tencent/Xiaomi/vivo JDs. Evidence must come from these original strings, including spaces.
- `spike-model-run-2.json`: only summary and per-job extracted output / semantic validation flags from `data/extractor-run-2.json`. Historical run was **5/6**, not a six-case oracle. Its vivo `ml` research token is deliberately rejected.
- `spike-reviewed-semantics.json`: only historical reviewed jobs/gates and the historical 24/24 summary from `data/gate-validation-run.json`. **No profiles, truth-table runner, or Qualification Engine was ported.** Old field names and normalized evidence are reference material, not persisted M0 Gates.
- `out-of-scope-model-output.json`: negative fixture captured during Task 5 live debugging. The provider extracted unrelated clauses despite a clause-scoped request. Runtime validation rejects this whole output. The production request now transmits only unresolved clauses.

`gate-extractor-spike-v2.cjs` and `gate-validator.cjs` were read as semantic references, not copied/executed. The allowed major/research vocabulary, preference handling, title-only ambiguity, and explicit-only rules are reused. `phd` is mapped to frozen M0 `doctorate`; old major domain/tag fields become `major`.

The reviewed Xiaomi expression `(doctorate AND related direction) OR (master AND long-term research intent)` exceeds the frozen Gate grammar. Keep its complete quote and two verbatim branches as **nonblocking `compound_or` metadata**. Do not add a Profile field, nested Gate grammar, or independent required doctorate/master conditions.

Known limitations remain visible: unrecognized major alternatives are retained whole as unsupported metadata rather than narrowing a list; tools/languages/experience/papers are not new gates. Audited textual evidence must be checked against the original JD; an old hand-normalized quote is not automatically valid evidence.

Offline: `npx vitest run tests/ingest/gate-extraction.test.ts`.
Optional live: `npm run extract:gates -- --corpus` (server DeepSeek environment required; six rows, model calls only for unresolved clauses; no Supabase write).
