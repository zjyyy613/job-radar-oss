import type { PersistedSourceRecord } from "../../src/lib/domain/source-record";
import type { ReliabilityRun } from "../../src/lib/domain/source-reliability";

export function record(id = "1", overrides: Partial<PersistedSourceRecord> = {}): PersistedSourceRecord {
  return { id: `00000000-0000-4000-8000-${id.padStart(12, "0")}`, source: "official", source_family: "company_ats", source_tier: "authoritative",
    source_job_id: id, source_url: null, company: "Acme", title: "Software Engineer", location: ["北京"],
    internship_type: null, recruitment_batch: "2027 campus", salary: null, industry: null, company_nature: null,
    company_size: null, welfare: [], published_at: null, deadline: null, description: "Original JD", requirements: null,
    apply_url: null, fetched_at: "2026-09-28T01:00:30Z", last_seen_at: "2026-09-28T01:00:30Z", raw_hash: "raw", raw_payload: {}, ...overrides };
}

export function run(n = 1, overrides: Partial<ReliabilityRun> = {}): ReliabilityRun {
  return { id: `run-${n}`, source: "official", source_family: "company_ats", source_tier: "authoritative", full_list: true,
    started_at: `2026-09-28T0${n}:00:00Z`, finished_at: `2026-09-28T0${n}:01:00Z`, status: "success",
    records_seen: 0, records_new: 0, records_updated: 0, adapter_version: "fixture-v1", error_type: null, error_message: null,
    record_observations: { present: [], closed: [] }, ...overrides };
}
