export type SourceTier = "authoritative" | "trusted_aggregator" | "discovery";

// Source-neutral fields shared by normalized source records and canonical jobs.
export interface JobContent {
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
}

export interface SourceRecord extends JobContent {
  source: string;
  source_family: string;
  source_tier: SourceTier;
  source_job_id: string;
  source_url: string | null;
  fetched_at: string;
  last_seen_at: string;
  raw_hash: string;
  raw_payload: unknown;
}

// Adapters emit SourceRecord; the database assigns the row UUID on persistence.
export interface PersistedSourceRecord extends SourceRecord {
  id: string;
}
