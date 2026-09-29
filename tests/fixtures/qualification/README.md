# Spike 24-case truth table

`spike-truth-table.json` contains the original `profiles`, `jobs`, and `expected` from the user-designated `C:\Users\zhang\job-radar-spike\data\gate-validation-run.json`. Expected outcomes were not changed. `gate-validator.cjs` was read to verify the original decision order and three-valued comparisons; it was not executed because it writes back into the Spike directory.

The production engine consumes only the frozen M0 contracts. Test-only representation mapping:

- `phd` → `doctorate`; old `education_at_least` / `gte` / `eq` / `includes_any` map to frozen minimum / one_of values.
- Legacy `major_tags` / `major_domains` become `major`. The four original profiles use their declared first major tag (HR, management, mechanical, AI); deterministic domain relationships retain their audited business/STEM meaning. No Profile fields are added.
- Legacy nested AND/OR and `long_term_research` are outside the frozen Gate contract and already preserved as nonblocking metadata by Task 5. They are not flattened or evaluated by Task 6. The M1 row still has its independent required research-area gate: P1/P2/P3 explicitly have `research_areas=[]`, which fails; P4 explicitly has `multimodal`, which passes. Therefore the original four M1 expected statuses remain unchanged, but no Blocked decision relies on the unsupported expression.
- Old preferred unsupported paper/OSS metadata is ignored for blocking.
- All 24 historical cases assume successfully extracted, current content. Separate tests exercise unprocessed, failed, stale, missing metadata, and truly empty ready gates.

Original expected matrix:

| Job | P1 | P2 | P3 | P4 |
|---|---|---|---|---|
| T1 | Blocked | Blocked | Eligible | Eligible |
| T2 | Eligible | Eligible | Eligible | Eligible |
| M1 | Blocked | Blocked | Blocked | Eligible |
| M2 | Eligible | Check | Blocked | Eligible |
| V1 | Blocked | Blocked | Blocked | Blocked |
| V2 | Blocked | Blocked | Eligible | Blocked |

Run: `npx vitest run tests/domain/qualification-engine.test.ts`.
No extraction, model call, or network is involved.
