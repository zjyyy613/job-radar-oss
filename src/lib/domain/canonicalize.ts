import { createHash } from "node:crypto";
import type { CanonicalJob } from "./canonical-job";
import type { JobContent, PersistedSourceRecord, SourceRecord } from "./source-record";
import { deriveReliability, type ReliabilityRun } from "./source-reliability";

export const CANONICALIZATION_VERSION = "deterministic-v1";
export interface MergeDecision { left: string; right: string; merge: boolean; reason: string }
export interface CanonicalizedJob extends CanonicalJob {
  canonicalization_trace: {
    version: string; primary_source_record_id: string; merges: MergeDecision[];
    reliability: ReturnType<typeof deriveReliability>;
  };
}
export interface CanonicalizationResult { jobs: CanonicalizedJob[]; decisions: MergeDecision[] }
const rank = { authoritative: 0, trusted_aggregator: 1, discovery: 2 };
const normalize = (value: string) => value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();
const identity = (record: SourceRecord) => JSON.stringify([record.source, record.source_job_id]);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
function uuid(value: string) {
  const h = hash(value);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function match(a: PersistedSourceRecord, b: PersistedSourceRecord): string | null {
  if (a.source === b.source) return "different_ids_same_source";
  if (!normalize(a.company) || normalize(a.company) !== normalize(b.company)) return "company_mismatch";
  if (!normalize(a.title) || normalize(a.title) !== normalize(b.title)) return "title_mismatch";
  const batchA = normalize(a.recruitment_batch ?? ""), batchB = normalize(b.recruitment_batch ?? "");
  if (!batchA || !batchB) return "program_unknown";
  if (batchA !== batchB) return "program_conflict";
  if (normalize(a.internship_type ?? "") !== normalize(b.internship_type ?? "")) return "internship_program_conflict";
  const locations = a.location.map(normalize).filter(Boolean);
  if (!locations.length || !b.location.some(city => locations.includes(normalize(city)))) return "location_incompatible_or_unknown";
  return null;
}

function content(record: SourceRecord): JobContent {
  // Whitelist domain content, never raw upstream keys. Preserve primary source text.
  return { company: record.company, title: record.title, location: [...record.location], internship_type: record.internship_type,
    recruitment_batch: record.recruitment_batch, salary: record.salary, industry: record.industry,
    company_nature: record.company_nature, company_size: record.company_size, welfare: [...record.welfare],
    published_at: record.published_at, deadline: record.deadline, description: record.description,
    requirements: record.requirements, apply_url: record.apply_url };
}

export function canonicalize(input: (SourceRecord & { id?: string })[], runs: ReliabilityRun[] = [], existing: CanonicalJob[] = []): CanonicalizationResult {
  const decisions: MergeDecision[] = [];
  const unique = new Map<string, PersistedSourceRecord>();
  const ordered = [...input].sort((a, b) => compare(identity(a), identity(b)) || Date.parse(b.fetched_at) - Date.parse(a.fetched_at) || compare(a.id ?? "", b.id ?? "") || compare(hash(content(a)), hash(content(b))));
  for (const record of ordered) {
    if (!record.source || !record.source_job_id || !Number.isFinite(Date.parse(record.fetched_at)) || !Number.isFinite(Date.parse(record.last_seen_at))) throw new Error("Invalid source identity/timestamps");
    const key = identity(record);
    const previous = unique.get(key);
    if (previous) {
      decisions.push({ left: previous.id, right: record.id ?? previous.id, merge: true, reason: "same_source_identity" });
    } else unique.set(key, { ...record, id: record.id ?? uuid(key) });
  }
  const records = [...unique.values()];
  if (new Set(records.map(r => r.id)).size !== records.length) throw new Error("Conflicting persisted source IDs");
  const matchesBySource = new Map(records.map(r => [r, new Map<string, number>()]));
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    if (match(a, b) === null) {
      for (const [left, right] of [[a, b], [b, a]]) {
        const counts = matchesBySource.get(left)!;
        counts.set(right.source, (counts.get(right.source) ?? 0) + 1);
      }
    }
  }
  function compatible(a: PersistedSourceRecord, b: PersistedSourceRecord) {
    return match(a, b) ?? ((matchesBySource.get(a)!.get(b.source) ?? 0) > 1 ||
      (matchesBySource.get(b)!.get(a.source) ?? 0) > 1 ? "ambiguous_same_source_candidates" : null);
  }
  const groups: PersistedSourceRecord[][] = [];
  for (const record of records) {
    // Complete-link matching: every pair must agree; no fuzzy/transitive bridges.
    const candidates = groups.filter(group => group.every(member => compatible(member, record) === null));
    if (candidates.length === 1) candidates[0].push(record);
    else groups.push([record]);
  }
  for (let i = 0; i < records.length; i++) for (let j = i + 1; j < records.length; j++) {
    const a = records[i], b = records[j];
    const merged = groups.some(group => group.includes(a) && group.includes(b));
    decisions.push({ left: a.id, right: b.id, merge: merged,
      reason: merged ? "exact_company_title_location_program" : compatible(a, b) ?? "ambiguous_group_conflict" });
  }
  const reservedIds = new Set(existing.map(j => j.id));
  const allocatedIds = new Set<string>();
  const jobs = groups.map(group => {
    const primary = [...group].sort((a, b) => rank[a.source_tier] - rank[b.source_tier] || Date.parse(b.fetched_at) - Date.parse(a.fetched_at) || compare(identity(a), identity(b)))[0];
    const ids = group.map(record => record.id).sort();
    const previous = existing.filter(job => ids.includes([...job.source_record_ids].sort()[0])).sort((a, b) => compare(a.id, b.id))[0];
    let id = previous?.id ?? uuid(`canonical:${identity(group[0])}`);
    let salt = 0;
    while (allocatedIds.has(id) || (!previous && reservedIds.has(id))) id = uuid(`split:${ids.join(",")}:${salt++}`);
    allocatedIds.add(id);
    const fields = content(primary);
    const reliability = deriveReliability(group, runs);
    return { ...fields, id, source_record_ids: ids,
      application_status: reliability.application_status, consecutive_missing_count: reliability.consecutive_missing_count,
      gates: [], raw_content_hash: hash(fields), extraction_version: null, extracted_at: null, extractor_type: null,
      canonicalization_trace: { version: CANONICALIZATION_VERSION, primary_source_record_id: primary.id,
        merges: decisions.filter(d => d.merge && ids.includes(d.left) && ids.includes(d.right)), reliability } } satisfies CanonicalizedJob;
  }).sort((a, b) => compare(a.id, b.id));
  return { jobs, decisions };
}
