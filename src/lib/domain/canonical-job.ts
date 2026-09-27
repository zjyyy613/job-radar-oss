import type { Gate } from "./gate";
import type { JobContent } from "./source-record";

export type ApplicationStatus = "open" | "closed" | "unknown";

export interface CanonicalJob extends JobContent {
  id: string;
  application_status: ApplicationStatus;
  source_record_ids: string[];
  gates: Gate[];
  raw_content_hash: string | null;
  extraction_version: string | null;
  extracted_at: string | null;
  extractor_type: string | null;
  consecutive_missing_count: number;
}
