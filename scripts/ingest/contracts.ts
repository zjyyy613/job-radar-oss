// A single domain contract is shared by every adapter; no source-specific copies.
export type { SourceRecord, PersistedSourceRecord, SourceTier } from "../../src/lib/domain/source-record";
export type { CanonicalJob, ApplicationStatus } from "../../src/lib/domain/canonical-job";
export { validateGate, type Gate } from "../../src/lib/domain/gate";

import type { SourceTier } from "../../src/lib/domain/source-record";

export type SourceRunStatus = "success" | "partial" | "failed";

// A completed run summary. full_list=false prevents partial scans from implying absence.
export interface SourceRun {
  id: string;
  source: string;
  source_family: string;
  source_tier: SourceTier;
  full_list: boolean;
  started_at: string;
  finished_at: string;
  status: SourceRunStatus;
  records_seen: number;
  records_new: number;
  records_updated: number;
  adapter_version: string;
  error_type: string | null;
  error_message: string | null;
}
