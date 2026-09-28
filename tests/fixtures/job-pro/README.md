# job-pro 1.2.1 live fixtures

Captured on 2026-09-27 16:49–16:50 UTC (2026-09-28 Asia/Shanghai).
These six JSON files are **unmodified CLI stdout**, not hand-authored example jobs.

For each of `tencent`, `xiaomi`, `vivo`:

```sh
job-pro <company> search "" --scope campus --page-size 2 --compact
job-pro <company> detail <first-search-result-post_id> --compact
```

The published bin of the locally installed `@ha7ch/job-pro@1.2.1` was invoked via Node.
All six commands exited 0 with `ok: true`; stderr was empty.

| Company | First detail ID | Sparse records |
| --- | --- | --- |
| Tencent | 1282707398326592512 | `tencent-search.json` → `positions` |
| Xiaomi | 7689291997559884086 | `xiaomi-search.json` → `positions` |
| vivo | 561286383 | `vivo-search.json` → `positions` |

Tencent/Xiaomi omit salary and deadline. vivo supplies salary but no deadline.
The vivo `post_date` has no timezone, so normalized `published_at` remains null;
the exact value remains in `raw_payload`. `project` differs by source (Tencent
graduate category, Xiaomi role category, vivo department), so it is **not** mapped
to recruitment batch. No year/batch is inferred from titles, and `kind=全职` does
not invent an internship type. Company names come from the explicit source
allowlist identity, not from guessed missing upstream company fields.

Fixtures prove the CLI shape at capture time, not continuing job availability or
that upstream filters perfectly classify internship/campus jobs. No semantic
reclassification is performed by this adapter.
