# Job Radar Technical Architecture v0.1 — Frozen

## 0. Authority and implementation discretion

This document is the frozen technical architecture for Job Radar M0.

Priority when implementing:
1. `docs/specs/job-radar-product-spec-v1.0.md`
2. this Technical Architecture v0.1
3. `docs/superpowers/plans/2026-09-27-job-radar-m0.md`

If a low-level implementation detail is not explicitly specified, the implementer is AUTHORIZED to define the minimum reasonable internal representation needed to satisfy the frozen product rules and current task acceptance tests.

Do not stop for clarification merely because:
- an internal type property name is not specified,
- a helper function signature is not specified,
- a JSON-safe normalized value representation is not exhaustively enumerated,
- a table/index name is not specified.

Do stop if a decision would change:
- product scope,
- qualification semantics,
- source authority semantics,
- privacy model,
- user-facing flow,
- M0/M1 boundary,
- external service choice.

No new features may be added during M0 implementation.

---

## 1. System objective

Job Radar is not a web crawler product.

It is a pipeline:

```text
External job sources
      ↓
Source adapters
      ↓
SourceRecord
      ↓
Normalization
      ↓
Conservative canonicalization
      ↓
CanonicalJob
      ↓
Gate extraction (new/changed jobs only)
      ↓
Validated gates
      ↓
Supabase
      ↓
Next.js web app + local guest profile
      ↓
Deterministic qualification engine
```

The product-specific core is:
- source normalization,
- conservative qualification gates,
- evidence,
- deterministic user/job evaluation,
- Radar browsing UX.

Crawler/source maintenance should be minimized by reusing mature projects.

---

## 2. External source strategy

### 2.1 job-pro

Role: primary Chinese company/ATS source.

Frozen integration approach for M0:
- pin `@ha7ch/job-pro@1.2.1`,
- invoke through CLI/process boundary,
- parse its structured output in our adapter,
- do not import its private/internal source files as our public dependency,
- start with a small explicit allowlist (at minimum Tencent, Xiaomi, vivo),
- expand only after smoke tests.

Reason:
- job-pro is CLI-first,
- its internal adapters expose source-specific payloads,
- CLI boundary provides lower coupling.

### 2.2 JobHunter / NCSS

Role: complementary public employment source.

Frozen integration approach for M0:
- pin a specific JobHunter commit,
- reuse only the NCSS crawler path,
- do not adopt JobHunter Flask app, SQLite database, Vue UI, generic website crawler, or duplicate company API crawlers,
- run NCSS ingestion independently from job-pro ingestion.

### 2.3 recruit-hub

Role: schema/reference/test fixture source only.

Do not treat the public repository as an authoritative live ingestion backend.

### 2.4 Nekomata

Role: deduplication philosophy/reference only.

Do not copy GPL-3.0 core code into the Job Radar codebase for M0.

Principles to borrow:
- precision over recall,
- hard conflict before fuzzy similarity,
- every automatic merge should have a trace/reason.

### 2.5 JobSpy

Not in M0.
Reserved for later international job expansion.

---

## 3. Source isolation rule

Every external source MUST pass through an adapter.

No UI, database query, qualification rule, or canonicalization function may depend on raw job-pro / JobHunter field names.

External code:
```text
job-pro / NCSS / future source
```

must become:
```text
SourceRecord
```

before entering the Job Radar domain.

---

## 4. SourceRecord contract

The exact TypeScript property names may be adjusted only if all references/tests are updated consistently.

Minimum semantic contract:

```ts
type SourceTier = "authoritative" | "trusted_aggregator" | "discovery";

interface SourceRecord {
  source: string;
  source_family: string;
  source_tier: SourceTier;

  source_job_id: string;
  source_url: string | null;

  company: string;
  title: string;
  location: string[];

  internship_type: string | null;
  recruitment_batch: string | null;

  salary: string | null;
  industry: string | null;
  company_nature: string | null;
  company_size: string | null;
  welfare: string[];

  published_at: string | null;
  deadline: string | null;

  description: string | null;
  requirements: string | null;
  apply_url: string | null;

  fetched_at: string;
  last_seen_at: string;
  raw_hash: string;
  raw_payload: unknown;
}
```

Rules:
- missing information is `null` or empty array as appropriate,
- never invent absent values,
- raw payload is retained for debugging/audit,
- `(source, source_job_id)` is unique.

---

## 5. CanonicalJob contract

Minimum semantic contract:

```ts
type ApplicationStatus = "open" | "closed" | "unknown";

interface CanonicalJob {
  id: string;

  company: string;
  title: string;
  location: string[];

  internship_type: string | null;
  recruitment_batch: string | null;

  salary: string | null;
  industry: string | null;
  company_nature: string | null;
  company_size: string | null;
  welfare: string[];

  published_at: string | null;
  deadline: string | null;

  description: string | null;
  requirements: string | null;
  apply_url: string | null;

  application_status: ApplicationStatus;

  source_record_ids: string[];

  gates: Gate[];

  raw_content_hash: string | null;

  extraction_version: string | null;
  extracted_at: string | null;
  extractor_type: string | null;

  consecutive_missing_count: number;
}
```

CanonicalJob is the object the web app consumes.

The app should not need to know whether a job came from job-pro or NCSS.

---

## 6. Gate contract

### 6.1 Requirement semantics

Frozen values:

```ts
type GateRequirement = "required" | "preferred" | "ambiguous";
```

Meaning:
- `required`: explicit hard requirement.
- `preferred`: preference / plus / “优先” / “更佳”; never blocks.
- `ambiguous`: requirement-like text exists but scope/meaning is not safe enough to treat as explicit hard requirement.

### 6.2 Gate fields for M0

Frozen M0 profile-aware fields:

```ts
type GateField =
  | "student_status"
  | "graduation_year"
  | "education"
  | "major"
  | "days_per_week"
  | "duration_months"
  | "research_areas";
```

If extraction finds a condition that M0 cannot deterministically compare to the user profile, it may be retained as non-blocking metadata or deferred, but MUST NOT produce `Blocked` until a deterministic rule/profile field exists.

Do not add new user profile fields during Task 1.

### 6.3 Gate scope

Minimum values:

```ts
type GateScope = "job" | "program";
```

Examples:
- body says “本科及以上” => usually `job`
- title-only “2027届” => may be `program` + `ambiguous`

### 6.4 Gate normalized value

The architecture intentionally does NOT freeze one giant universal value schema.

Task 1 is authorized to define the smallest JSON-safe discriminated union that covers the M0 fields above.

Requirements:
- values must be runtime-validatable,
- compound OR must remain OR,
- no lossy string flattening for structured alternatives,
- unsupported/unknown values must be rejected or preserved as non-blocking rather than guessed.

Recommended minimal shapes are acceptable, e.g.:
- scalar string,
- numeric minimum,
- list/set of allowed values,
- education minimum,
- OR of alternatives.

### 6.5 Evidence contract

Evidence MUST be source-grounded.

Minimum semantic structure:

```ts
interface GateEvidence {
  quote: string; // verbatim source text, non-empty
  source: "title" | "description" | "requirements" | "other";
  context: string | null; // optional surrounding verbatim text
}
```

Rules:
- `quote` MUST be copied from the source job text,
- model-generated paraphrase is not evidence,
- `context` is optional but if present must also be source-grounded,
- at least one evidence item is required for a persisted gate.

### 6.6 Minimum Gate shape

```ts
interface Gate {
  id: string;
  field: GateField;
  requirement: GateRequirement;
  scope: GateScope;
  value: GateValue;
  evidence: GateEvidence[];
  note: string | null;
}
```

`GateValue` is the minimal discriminated union defined by Task 1 under §6.4.

### 6.7 Runtime validation

Task 1 MUST provide runtime validation.

Malformed gates are rejected.

At minimum reject:
- unknown `requirement`,
- unknown `field`,
- empty evidence list,
- empty evidence quote,
- malformed structured value.

---

## 7. Qualification Profile vs Preference Profile

These are separate domain objects.

### QualificationProfile

M0:
- `student_status`
- `graduation_year`
- `education`
- `major`
- `days_per_week` (optional)
- `duration_months` (optional)
- `research_areas` (optional / only when needed)

### PreferenceProfile

M0 may include:
- `preferred_cities`
- `preferred_roles`
- `preferred_companies`

Hard rule:

Preference fields MUST NOT participate in `Blocked`.

---

## 8. Deterministic qualification engine

The final user-facing status is NOT decided by an LLM.

Decision order:

```text
if application_status == closed
  => Excluded

else if any explicit required gate clearly contradicts profile
  => Blocked

else if any required gate cannot be evaluated because profile data is missing
  => Check

else if any ambiguous gate is not clearly satisfied
  => Check

else
  => Eligible
```

Preferred gates:
- may be displayed,
- may influence secondary information later,
- MUST NOT block.

False Blocked is the highest-severity qualification error.

---

## 9. Canonicalization

M0 uses deterministic conservative logic only.

### Level 1
Same `(source, source_job_id)` => same source record.

### Level 2
Cross-source automatic merge only when high-confidence signals agree, such as:
- normalized company,
- normalized title,
- compatible/overlapping location,
- compatible recruitment batch/program.

### Level 3
If uncertain => DO NOT MERGE.

No:
- embeddings,
- vector similarity,
- LLM merge decisions.

Every automatic merge should return a trace/reason.

A batch/program conflict is a hard reason not to merge automatically.

---

## 10. Source reliability and closing rules

Source run states:

```ts
type SourceRunStatus = "success" | "partial" | "failed";
```

Application state rules:

### Open
Confirmed present by an authoritative current source.

### Closed
Only when:
1. upstream explicitly reports closed, OR
2. posting is absent in two consecutive successful authoritative full-list runs.

### Unknown
Use when current source state cannot be verified, including:
- timeout,
- 403,
- 5xx,
- crawler failure,
- incomplete source run.

A failed source run MUST NOT increment a job's missing counter.

Store at least:
- `consecutive_missing_count`
- source run status
- run started/finished timestamps
- records seen
- adapter version
- error type/message when failed

No admin dashboard is required in M0.

---

## 11. Gate extraction pipeline

Gate extraction occurs during ingestion/background processing, not during user page load.

```text
CanonicalJob changed?
  ↓ no
stop

  ↓ yes
deterministic parser
  ↓
unresolved/complex clauses?
  ↓ yes
DeepSeek fallback
  ↓
runtime validation
  ↓
persist gates + extraction metadata
```

Rules:
- obvious gates should be parsed deterministically when practical,
- LLM is fallback for complex semantics,
- malformed model output is rejected,
- invalid new extraction must not overwrite prior valid gates,
- unchanged `raw_content_hash` => no model call.

Extraction semantics already frozen from spike:
- title-only graduation year => generally `ambiguous`, `scope=program` unless body explicitly restricts,
- “XX专业优先” => preferred,
- “有经验优先/更佳” => preferred,
- ambiguous wording => ambiguous,
- compound OR must stay OR,
- null means absent,
- no invention.

---

## 12. Persistence

M0 uses Supabase PostgreSQL.

Minimum tables:

### `source_records`
Purpose: normalized per-source records.

Minimum requirements:
- unique `(source, source_job_id)`,
- `raw_payload JSONB`,
- timestamps/provenance,
- normalized job fields.

### `jobs`
Purpose: canonical jobs consumed by web app.

Minimum requirements:
- canonical display fields,
- `application_status`,
- `gates JSONB`,
- `raw_content_hash`,
- extraction metadata,
- `consecutive_missing_count`.

### `source_runs`
Purpose: reliability/audit for each ingestion run.

Minimum requirements:
- source key,
- started/finished timestamps,
- status,
- records seen/new/updated,
- adapter version,
- optional error type/message.

Task 1 may choose practical column/index names as long as semantics above are preserved.

No normalized multi-table gate graph is required in M0.
Use JSONB for gates.

---

## 13. Guest/local state

M0 does not require authentication.

Server:
- jobs,
- source records,
- source runs,
- gates.

Browser local state:
- qualification profile,
- preferences,
- selected local UI preferences,
- later M1: saved/hidden/seen.

Task 1 does not need to implement local persistence yet beyond defining domain contracts if the plan places it in Task 6.

Do not add Supabase Auth in M0.

---

## 14. Web application

Frozen stack:
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- nuqs for URL-backed Radar state
- Supabase PostgreSQL

No monorepo.

Radar M0:
- Browse mode by default,
- click row => Inspect / Detail Peek,
- explicit full detail page,
- desktop resizable/collapsible detail,
- medium overlay,
- mobile list -> full-screen detail.

Visual baseline:
- Calm Precision,
- warm neutral surfaces,
- graphite primary action,
- minimal semantic color,
- row-based list,
- avoid dashboard/card overload.

---

## 15. Scheduling

M0 ingestion runs outside user request paths.

Preferred:
- GitHub Actions for ingestion,
- independent job-pro and NCSS workflows,
- source failures isolated from one another.

Do not add:
- Redis,
- message queues,
- Celery,
- BullMQ,
- custom worker cluster,
unless later evidence proves necessary.

---

## 16. M0 / M1 boundary

M0:
- minimal onboarding,
- qualification profile,
- real multi-source jobs,
- search/basic filter/sort,
- Radar list,
- qualification engine,
- Detail Peek,
- evidence,
- Full Detail,
- source/freshness,
- official apply,
- basic responsive behavior.

M1:
- Saved,
- Hide + Undo,
- Seen/New,
- inline profile completion,
- fuller empty/error states,
- mobile/accessibility polish.

Later:
- Compare,
- Saved Views,
- account sync,
- landing page,
- international JobSpy,
- notifications,
- application tracker,
- JD Lens integration.

Explicitly not M0:
- resume generator,
- cover-letter generator,
- auto-apply,
- 0–100 match score,
- social/community,
- semantic/vector search.

---

## 17. Task 1 implementation authorization

For Task 1 specifically, the implementer is explicitly authorized to:

- initialize a minimal Next.js 16 / React 19 / TypeScript app if the repository is empty,
- initialize a local Git repository if absent,
- add only the minimum test tooling needed to run Task 1 contract tests,
- define the minimal `GateValue` discriminated union satisfying §6.4,
- choose practical SQL primary key types and index names,
- choose file-local helper names/signatures,
- add runtime validation without introducing a large framework if a simple implementation is sufficient.

The implementer is NOT authorized to:
- start Task 2,
- add authentication,
- add application pages beyond what Task 1 requires,
- add unnecessary state libraries,
- add ORM/database abstraction unless required,
- change qualification semantics,
- change source priority/reliability rules,
- add new product functionality.

---

## 18. Git identity

If Git commit identity is not configured:
- do not guess or invent an email address,
- do not change global Git configuration automatically,
- implementation and tests may proceed,
- stop before the commit step and report that the commit is pending identity configuration.

A local repository may still be initialized.

---

## 19. M0 architecture stop rule

The architecture is considered satisfied when:
- multiple source families can enter through one SourceRecord contract,
- jobs are conservatively canonicalized,
- changed jobs receive validated gates,
- guest profile is evaluated deterministically,
- a user can browse, inspect evidence, read the full JD, and open the official source.

Do not redesign architecture merely because M1 features are absent.
