# NCSS fixtures

`list-live.json` is an unmodified JSON response fetched on 2026-09-28 from
`https://www.ncss.cn/student/jobs/jobslist/ajax/` using the pinned JobHunter query
parameters (`offset=1`, `limit=2`, `sourcesName=0`; other filters empty).
Capture used a direct HTTP request; the production wrapper uses the upstream
Playwright session and same-origin fetch path. No credentials are in the fixture.

Both records contain jobName/recName/areaCodeName, salary bounds (including 5.4),
degreeName, epoch-millisecond publishDate, recProperty, recScale and jobId.
Source URL uses the upstream jobId URL template. Missing industry is genuinely
absent in this response. `synthetic-industry.json` and test-only alias variants
cover the upstream industry fields explicitly as synthetic data; no invented
field is inserted into the real fixture or sent to Supabase.

Education is retained verbatim in raw_payload.degreeName; the frozen SourceRecord
has no education field. No gates or inferred requirements are generated here.
Description, requirements, deadline and external apply_url remain null without
detail data. NCSS is a trusted_aggregator in the public_employment source family,
not an employer-authoritative source. Empty/unknown metadata remains null/[];
no location expansion or recruitment inference is performed.
