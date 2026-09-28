import { createHash } from "node:crypto";
import type { SourceRecord } from "./contracts";
import { isJobProSource, JOB_PRO_SOURCES, sourceIdentity, type JobProSource } from "./job-pro-sources";

function fail(field: string): never {
  throw new TypeError(`Invalid job-pro record: ${field}`);
}

export function upstreamObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("object expected");
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") fail(field);
  return value.trim() ? value : null;
}

function locations(value: unknown, source: JobProSource): string[] {
  if (value === undefined || value === null || value === "") return [];
  if (Array.isArray(value)) {
    return value.map((item) => {
      const name = source === "xiaomi" && typeof item === "object" && item !== null
        ? upstreamObject(item).name : item;
      return text(name, "work_cities item") ?? fail("empty work_cities item");
    });
  }
  const list = text(value, "work_cities");
  if (!list) return [];
  const delimiter = source === "tencent" ? /\s+/ : source === "xiaomi" ? /\s*\/\s*/ : /\s*[,，]\s*/;
  return list.split(delimiter).map((city) => city.trim()).filter(Boolean);
}

function url(value: unknown): string | null {
  const candidate = text(value, "apply_url");
  if (candidate === null) return null;
  const parsed = new URL(candidate);
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) fail("apply_url");
  return candidate;
}

// Only explicitly timezone-qualified timestamps can enter timestamptz columns.
function timestamp(value: unknown): string | null {
  const candidate = text(value, "post_date");
  if (!candidate || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(candidate)) return null;
  const ms = Date.parse(candidate);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return fail("non-JSON payload");
}

/** Accepts a CLI detail object or an unchanged item from CLI search.positions. */
export function mapJobProRecord(raw: unknown, sourceKey: JobProSource, fetchedAt = new Date().toISOString()): SourceRecord {
  if (!isJobProSource(sourceKey)) fail("source outside allowlist");
  const payload = upstreamObject(raw);
  if (payload.ok !== undefined && payload.ok !== true) fail("upstream not ok");
  if (payload.source !== undefined && payload.source !== JOB_PRO_SOURCES[sourceKey].upstream) fail("source mismatch");
  // These three CLI sources emit decimal-string IDs, some larger than JS safe integers.
  if (typeof payload.post_id !== "string" || !/^\d+$/.test(payload.post_id)) fail("post_id");
  const title = text(payload.title, "title") ?? fail("title missing");
  if (!Number.isFinite(Date.parse(fetchedAt))) fail("fetched_at");
  const applyUrl = url(payload.apply_url);
  return {
    ...sourceIdentity(sourceKey),
    source_job_id: payload.post_id,
    source_url: applyUrl,
    company: JOB_PRO_SOURCES[sourceKey].company,
    title,
    location: locations(payload.work_cities, sourceKey),
    // CLI project/recruit_label/kind do not reliably identify batch/internship type.
    internship_type: null,
    recruitment_batch: null,
    salary: text(payload.salary, "salary"),
    industry: null,
    company_nature: null,
    company_size: null,
    welfare: [],
    published_at: timestamp(payload.post_date),
    deadline: null,
    description: text(payload.description, "description"),
    requirements: text(payload.requirements, "requirements"),
    apply_url: applyUrl,
    fetched_at: fetchedAt,
    last_seen_at: fetchedAt,
    raw_hash: createHash("sha256").update(stableJson(raw)).digest("hex"),
    raw_payload: structuredClone(raw),
  };
}
