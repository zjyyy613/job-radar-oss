import type { SourceRun } from "../../../scripts/ingest/contracts";
import type { ApplicationStatus } from "./canonical-job";
import type { PersistedSourceRecord } from "./source-record";

/** null means no historical snapshot. full_list must cover the entire source key,
 * across programs. closed contains explicit upstream closure, never HTTP errors. */
export interface RunObservations { present: string[]; closed: string[] }
export interface ReliabilityRun extends SourceRun { record_observations?: RunObservations | null }
export interface SourceReliability {
  source_record_id: string;
  application_status: ApplicationStatus;
  consecutive_missing_count: number;
  reason: string;
  run_id: string | null;
}

function observations(value: RunObservations | null | undefined): RunObservations | null {
  if (value == null) return null;
  if (!Array.isArray(value.present) || !Array.isArray(value.closed) ||
      [...value.present, ...value.closed].some(id => typeof id !== "string" || !id.trim()) ||
      new Set([...value.present, ...value.closed]).size !== value.present.length + value.closed.length) {
    throw new Error("Invalid normalized run observations");
  }
  return value;
}

function forRecord(record: PersistedSourceRecord, runs: ReliabilityRun[]): SourceReliability {
  const state: SourceReliability = { source_record_id: record.id, application_status: "unknown", consecutive_missing_count: 0, reason: "no_verifiable_run", run_id: null };
  let streak = 0;
  const unique = new Map<string, ReliabilityRun>();
  for (const run of runs.filter(run => run.source === record.source)) {
    if (unique.has(run.id) && JSON.stringify(unique.get(run.id)) !== JSON.stringify(run)) throw new Error("Conflicting duplicate run ID");
    unique.set(run.id, run);
  }
  const sorted = [...unique.values()].sort((a, b) => Date.parse(a.finished_at) - Date.parse(b.finished_at) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let previousFinished = -Infinity;
  for (const run of sorted) {
    const start = Date.parse(run.started_at), finish = Date.parse(run.finished_at);
    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) throw new Error("Invalid run timestamps");
    // Historical absence cannot override a more recent saved observation.
    if (finish < Date.parse(record.last_seen_at)) continue;
    state.run_id = run.id;
    state.application_status = "unknown";
    const evidence = observations(run.record_observations);
    if (start < previousFinished || run.source_tier !== record.source_tier || run.source_family !== record.source_family) {
      streak = 0; state.reason = "overlapping_or_incompatible_run"; previousFinished = Math.max(previousFinished, finish); continue;
    }
    previousFinished = finish;
    if (run.status === "failed") { streak = 0; state.reason = "source_failed"; continue; }
    if (evidence?.closed.includes(record.source_job_id)) {
      state.application_status = "closed"; state.reason = "explicit_upstream_closed"; streak = 0; continue;
    }
    if (run.status === "partial") { streak = 0; state.reason = "incomplete_run"; continue; }
    if (run.status !== "success") throw new Error("Invalid source run status");
    const seen = Date.parse(record.last_seen_at);
    const present = evidence ? evidence.present.includes(record.source_job_id) : seen >= start && seen <= finish;
    if (evidence && !present && seen >= start && seen <= finish) {
      streak = 0; state.reason = "contradictory_presence_evidence"; continue;
    }
    if (present) {
      streak = 0; state.consecutive_missing_count = 0;
      state.application_status = record.source_tier === "authoritative" ? "open" : "unknown";
      state.reason = record.source_tier === "authoritative" ? "authoritative_present" : "aggregator_presence_only";
    } else if (run.full_list && evidence && record.source_tier === "authoritative") {
      state.consecutive_missing_count = ++streak;
      state.application_status = streak >= 2 ? "closed" : "unknown";
      state.reason = streak >= 2 ? "two_consecutive_full_list_absences" : "one_full_list_absence";
    } else {
      streak = 0; state.reason = "absence_not_proven";
    }
  }
  return state;
}

/** Replay immutable evidence so rerunning canonicalization cannot double count. */
export function deriveReliability(records: PersistedSourceRecord[], runs: ReliabilityRun[]) {
  const sources = records.map(record => forRecord(record, runs));
  const authoritative = sources.filter((_, i) => records[i].source_tier === "authoritative");
  const relevant = authoritative.length ? authoritative : sources;
  const open = relevant.some(s => s.application_status === "open");
  const explicitClosed = relevant.some(s => s.reason === "explicit_upstream_closed");
  const application_status: ApplicationStatus = open && !explicitClosed ? "open"
    : relevant.length > 0 && relevant.every(s => s.application_status === "closed") ? "closed" : "unknown";
  return { application_status, consecutive_missing_count: authoritative.length ? Math.min(...authoritative.map(s => s.consecutive_missing_count)) : 0, sources };
}

export function deriveApplicationStatus(records: PersistedSourceRecord[], runs: ReliabilityRun[]): ApplicationStatus {
  return deriveReliability(records, runs).application_status;
}
