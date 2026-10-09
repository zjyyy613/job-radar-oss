import type { CanonicalJob } from "../domain/canonical-job";
import type { ExtractionReadiness } from "../domain/qualification-engine";
import type { SourceTier } from "../domain/source-record";
export interface SourceMeta {
  id: string;
  source: string;
  source_family: string;
  source_tier: SourceTier;
  source_url: string | null;
  fetched_at: string;
  last_seen_at: string;
}
export interface SourceHealth {
  source: string;
  status: "success" | "partial" | "failed";
  finished_at: string;
}
export interface JobReadModel extends CanonicalJob, ExtractionReadiness {
  sources: SourceMeta[];
}
export interface RadarData {
  jobs: JobReadModel[];
  sourceHealth: SourceHealth[];
  warnings: string[];
}
export const JOB_COLUMNS =
  "id,company,title,location,internship_type,recruitment_batch,salary,industry,company_nature,company_size,welfare,published_at,deadline,description,requirements,apply_url,application_status,source_record_ids,gates,raw_content_hash,extraction_version,extracted_at,extractor_type,consecutive_missing_count,extraction_status,extraction_input_hash,extraction_attempt_hash,extraction_error";
export const SOURCE_COLUMNS =
  "id,source,source_family,source_tier,source_url,fetched_at,last_seen_at";
export type ReadRows = <T>(
  table: string,
  params: Record<string, string>,
) => Promise<T[]>;
/** Server read composition, injected for offline tests. No upstream payload/API fields. */
export async function queryRadar(read: ReadRows): Promise<RadarData> {
  const jobs = await read<Omit<JobReadModel, "sources">>("jobs", {
    select: JOB_COLUMNS,
    order: "id",
  });
  const ids = [...new Set(jobs.flatMap((job) => job.source_record_ids))];
  const sourceRows = new Map<string, SourceMeta>();
  let sourceBatchFailed = false;
  async function readSources() {
    // Keep URLs bounded and retain successful batches if another batch fails.
    for (let offset = 0; offset < ids.length; offset += 100) {
      try {
        const batch = ids.slice(offset, offset + 100);
        const rows = await read<SourceMeta>("source_records", {
          select: SOURCE_COLUMNS,
          id: `in.(${batch.join(",")})`,
          order: "id",
        });
        for (const row of rows) if (batch.includes(row.id)) sourceRows.set(row.id, row);
      } catch {
        sourceBatchFailed = true;
      }
    }
    return [...sourceRows.values()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }
  const [sources, runs] = await Promise.allSettled([
    readSources(),
    read<SourceHealth>("source_runs", {
      select: "source,status,finished_at",
      order: "finished_at.desc,id.desc",
    }),
  ]);
  const latest = new Map<string, SourceHealth>();
  if (runs.status === "fulfilled")
    for (const run of runs.value)
      if (!latest.has(run.source)) latest.set(run.source, run);
  return {
    jobs: jobs.map((job) => ({
      ...job,
      sources:
        sources.status === "fulfilled"
          ? sources.value.filter((s) => job.source_record_ids.includes(s.id))
          : [],
    })),
    sourceHealth: [...latest.values()],
    warnings: [
      sources.status === "rejected" || sourceBatchFailed
        ? "来源详情暂不可用，岗位内容仍可浏览。"
        : "",
      runs.status === "rejected"
        ? "来源更新状态暂不可用，请以原始岗位为准。"
        : "",
    ].filter(Boolean),
  };
}
export function safeExternalUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
