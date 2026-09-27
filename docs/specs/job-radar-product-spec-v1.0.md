# Job Radar Product Spec v1.0 — Frozen

## Product goal
Help university students, internship seekers, and cross-major candidates quickly determine which real job postings are worth continuing to inspect by combining real-job aggregation, minimum qualification profile, conservative hard-gate judgment, and verbatim evidence.

## Product boundary
Job Radar is breadth filtering. JD Lens is single-JD deep analysis.

## Product principles
1. Qualification first, not match score.
2. Conservative judgment: ambiguity or missing profile information => Check, not Blocked.
3. Only explicit required + clear contradiction => Blocked.
4. Preferred conditions never Block.
5. Evidence must come from verbatim source text.
6. Official/authoritative sources outrank aggregators.
7. Network/source failure is not equivalent to Closed.
8. AI extracts; deterministic logic produces the user-facing qualification status.
9. Preference fields never participate in blocking.
10. Guest-first; no login wall.

## User-facing statuses
- Eligible internally => “当前条件无明显冲突” or silent in list.
- Check => “需确认：<reason>”.
- Blocked => “不符合：<reason>”.
- Unknown => “状态未明：<reason>”.
- Closed => “已关闭”.

## M0 pages
- Minimal onboarding
- Radar Browse
- Radar Inspect / Detail Peek
- Full Job Detail
- Profile
- Responsive basic mobile detail/list

## M0 source architecture
- job-pro: primary Chinese company/ATS source.
- JobHunter NCSS: complementary public employment source.
- recruit-hub: schema/fixture reference only.
- Nekomata: deduplication philosophy/reference only.
- JobSpy: later international expansion.

## Qualification profile
Gate fields:
- student_status
- graduation_year
- education
- major
- days_per_week (optional at onboarding)
- duration_months (optional at onboarding)
- research_areas only when required by specific jobs

Preference fields:
- preferred_cities
- preferred_roles
- preferred_companies

Preference fields MUST NOT produce Blocked.

## Qualification engine
Decision order:
1. closed => Excluded
2. any explicit required gate clearly fails => Blocked
3. any explicit required gate is unknown because user profile is missing => Check
4. any ambiguous gate is not clearly satisfied => Check
5. otherwise => Eligible

Preferred gates are ignored for blocking.

## Evidence hierarchy
Normalized Gate -> short verbatim Evidence -> original context -> full raw JD.

## Reliability
- Source run failure => source state Unknown, not Closed.
- Missing from a successful authoritative full-list run increments consecutive_missing_count.
- Closed may be inferred only after explicit upstream closure or two consecutive successful authoritative runs where the posting is absent.
- False Blocked is treated as the highest-severity qualification error.

## Visual/interaction baseline
- Calm Precision.
- Warm neutral surfaces, graphite primary action.
- Minimal semantic color.
- Row-based job list.
- Browse by default; Inspect opens on click.
- Desktop Detail Peek is resizable and collapsible.
- Full Detail is explicit deep-read mode.
- Mobile uses list -> full-screen detail, not desktop split view.

## Out of M0
Saved, Hide, Seen/New, Compare, Saved Views, Account Sync, Landing, Advanced Profile, notifications, application tracker, JD Lens integration, resume generator, cover-letter generator, auto-apply, match score, social/community.
