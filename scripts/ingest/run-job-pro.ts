import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { SourceRun } from "./contracts";
import { detailAdmission, mapJobProRecord, upstreamObject } from "./job-pro-adapter";
import { invokeJobPro, JobProFailure } from "./job-pro-cli";
import { ADAPTER_VERSION, JOB_PRO_SOURCES, isJobProSource, sourceIdentity, type JobProScope, type JobProSource } from "./job-pro-sources";
import { createSourceStore, serverConfig, type IngestionStore } from "./source-store";

export interface RunOptions {
  sources: readonly JobProSource[]; scope: JobProScope;
  /** Page size; legacy --limit remains supported. */
  limit: number; maxPages?: number; maxJobs?: number; globalMaxJobs?: number;
  /** First page to fetch (1-based). Lets a run target a later window. */
  startPage?: number;
}
interface Dependencies { cli: (args: readonly string[]) => Promise<unknown>; store?: IngestionStore; now?: () => string }
/** Hard ceiling for the controlled pagination range (page index is 1-based). */
const MAX_PAGE = 20;
function bounds(options: RunOptions) {
  const limits = { maxPages: options.maxPages ?? 1, maxJobs: options.maxJobs ?? options.limit, globalMaxJobs: options.globalMaxJobs ?? 15,
    startPage: options.startPage ?? 1 };
  if (!options.sources.length || options.sources.some(source => !isJobProSource(source)) || new Set(options.sources).size !== options.sources.length) throw new Error("Invalid source allowlist selection");
  if (!["campus", "intern"].includes(options.scope)) throw new Error("Use campus/intern");
  for (const [value, max] of [[options.limit, 50], [limits.maxPages, MAX_PAGE], [limits.maxJobs, 500], [limits.globalMaxJobs, 500]]) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error("Invalid pagination budget");
  }
  if (!Number.isInteger(limits.startPage) || limits.startPage < 1 || limits.startPage > MAX_PAGE) throw new Error("Invalid start page");
  // A window may never reach past the controlled pagination range.
  if (limits.startPage + limits.maxPages - 1 > MAX_PAGE) throw new Error("Start page and page budget exceed the page range");
  return limits;
}

export async function runIngestion(options: RunOptions, { cli, store, now = () => new Date().toISOString() }: Dependencies) {
  const limits = bounds(options);
  const sources = [];
  const skipped_sources: string[] = [];
  let globallyListed = 0;
  for (const source of options.sources) {
    if (globallyListed >= limits.globalMaxJobs) { skipped_sources.push(source); continue; }
    const started = performance.now();
    const sourceDeadline = started + 5 * 60_000;
    const run: SourceRun = {
      id: randomUUID(), ...sourceIdentity(source), full_list: false,
      started_at: now(), finished_at: now(), status: "success",
      records_seen: 0, records_new: 0, records_updated: 0,
      adapter_version: ADAPTER_VERSION, error_type: null, error_message: null,
    };
    const metrics = { pages_fetched: 0, listed: 0, response_records: 0, duplicate_ids: 0,
      detail_attempted: 0, detail_success: 0, admission_passed: 0, admission_rejected: 0,
      duration_ms: 0, stop_reason: "max_pages", failure_reasons: {} as Record<string, number>,
      // Content-free stage totals, so a timeout can be attributed to search, detail
      // or persistence instead of being guessed at.
      search_ms: 0, detail_ms: 0, upsert_ms: 0 };
    const result = { run, metrics, records_mapped: 0, records_written: 0, mapped_ids: [] as string[],
      rejections: [] as { source_job_id: string | null; reason: string }[], audit_written: false, audit_error: null as string | null };
    const errors: string[] = [];
    const fail = (reason: string) => { errors.push(reason); metrics.failure_reasons[reason] = (metrics.failure_reasons[reason] ?? 0) + 1; };
    const seen = new Set<string>();
    // Keep page size constant: shrinking later pages would change offset and repeat/skip IDs.
    const pageSize = Math.min(options.limit, source === "antgroup" ? 49 : 50, limits.maxJobs, limits.globalMaxJobs - globallyListed);
    // Start at the requested page; skipped pages are never fetched, so records_seen
    // reflects only the records this run actually processed.
    const lastPage = limits.startPage + limits.maxPages - 1;
    pages: for (let page = limits.startPage; page <= lastPage; page++) {
      if (metrics.listed + pageSize > limits.maxJobs) { metrics.stop_reason = "max_jobs"; break; }
      if (globallyListed + pageSize > limits.globalMaxJobs) { metrics.stop_reason = "global_max_jobs"; break; }
      if (performance.now() >= sourceDeadline) { fail("source_timeout"); metrics.stop_reason = "source_timeout"; break; }
      let search: Record<string, unknown>;
      try {
        const searchStarted = performance.now();
        search = upstreamObject(await cli([source, "search", "", "--scope", options.scope, "--page-size", String(pageSize), "--page", String(page), "--compact"]));
        metrics.search_ms += Math.round(performance.now() - searchStarted);
        if (search.ok !== true || search.source !== JOB_PRO_SOURCES[source].upstream || !Array.isArray(search.positions) || !Number.isInteger(search.total) || Number(search.total) < 0) throw new Error("Invalid search");
        if (Number(search.total) < search.positions.length || (!search.positions.length && (page - 1) * pageSize < Number(search.total))) throw new Error("Inconsistent search");
      } catch (error) {
        fail(error instanceof JobProFailure ? error.kind : "search_failed"); metrics.stop_reason = "search_failed"; break;
      }
      const rawPositions = search.positions as unknown[];
      metrics.pages_fetched++; metrics.response_records += rawPositions.length;
      // Contract drift cannot turn a bounded request into an unbounded detail fan-out.
      const positions = rawPositions.slice(0, pageSize);
      metrics.listed += positions.length; globallyListed += positions.length; run.records_seen = metrics.listed;
      let newIds = 0;
      for (const item of positions) {
        if (performance.now() >= sourceDeadline) { fail("source_timeout"); metrics.stop_reason = "source_timeout"; break pages; }
        let id: string | null = null;
        let stage = "invalid_record";
        try {
          const listed = mapJobProRecord(item, source, now()); id = listed.source_job_id;
          if (seen.has(id)) { metrics.duplicate_ids++; continue; }
          seen.add(id); newIds++;
          stage = "detail_failed"; metrics.detail_attempted++;
          const detailStarted = performance.now();
          const detail = upstreamObject(await cli([source, "detail", id, "--compact"]));
          metrics.detail_ms += Math.round(performance.now() - detailStarted);
          if (detail.ok !== true || detail.source !== JOB_PRO_SOURCES[source].upstream) throw new Error("Invalid detail");
          metrics.detail_success++; stage = "invalid_record";
          const record = mapJobProRecord(detail, source, now());
          if (record.source_job_id !== id) throw new Error("Detail identity mismatch");
          const reason = detailAdmission(record, source);
          if (reason) { stage = reason; throw new Error("Admission rejected"); }
          metrics.admission_passed++; result.records_mapped++; result.mapped_ids.push(id);
          if (store) {
            stage = "write_failed";
            const upsertStarted = performance.now();
            const disposition = await store.upsertRecord(record);
            metrics.upsert_ms += Math.round(performance.now() - upsertStarted);
            if (disposition === "new") run.records_new++; else run.records_updated++;
            result.records_written++;
          }
        } catch (error) {
          const reason = error instanceof JobProFailure ? error.kind : stage;
          fail(reason);
          if (stage !== "write_failed") { metrics.admission_rejected++; result.rejections.push({ source_job_id: id, reason }); }
          if (error instanceof JobProFailure && ["rate_limited", "access_denied"].includes(error.kind)) { metrics.stop_reason = error.kind; break pages; }
        }
      }
      if (positions.length && !newIds && metrics.duplicate_ids) { fail("repeated_page"); metrics.stop_reason = "repeated_page"; break; }
      if (page * pageSize >= Number(search.total)) { metrics.stop_reason = "query_exhausted"; break; }
      if (!positions.length) { metrics.stop_reason = "query_exhausted"; break; }
      if (metrics.listed >= limits.maxJobs) { metrics.stop_reason = "max_jobs"; break; }
      if (globallyListed >= limits.globalMaxJobs) { metrics.stop_reason = "global_max_jobs"; break; }
    }
    if (errors.length) {
      run.status = (store ? result.records_written : result.records_mapped) > 0 ? "partial" : "failed";
      run.error_type = errors[0]; run.error_message = `${errors.length} failure(s): ${[...new Set(errors)].join(", ")}`;
    }
    run.finished_at = now(); metrics.duration_ms = Math.round(performance.now() - started);
    if (store) {
      try { await store.writeRun(run); result.audit_written = true; }
      catch { result.audit_error = "source_runs write failed"; }
    }
    sources.push(result);
  }
  const succeeded = sources.filter(source => source.run.status === "success" && !source.audit_error).length;
  return { status: succeeded === sources.length ? "success" : sources.some(source => source.run.status !== "failed") ? "partial" : "failed",
    dry_run: !store, limits, skipped_sources, globally_listed: globallyListed, sources };
}

export function parseOptions(args: string[]): RunOptions & { dryRun: boolean } {
  const options: RunOptions & { dryRun: boolean } = { sources: ["tencent", "xiaomi", "vivo"], scope: "campus", limit: 5, maxPages: 1, maxJobs: 5, globalMaxJobs: 15, startPage: 1, dryRun: false };
  let mode: string | undefined;
  const used = new Set<string>();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (used.has(key)) throw new Error("Duplicate option");
    used.add(key);
    if (key === "--write" || key === "--dry-run") {
      if (mode) throw new Error("Choose exactly one of --write / --dry-run");
      mode = key; options.dryRun = key === "--dry-run";
    } else if (["--sources", "--scope", "--limit", "--max-pages", "--max-jobs", "--global-max-jobs", "--start-page"].includes(key)) {
      const value = args[++i];
      if (!value) throw new Error("Missing option value");
      if (key === "--sources") options.sources = value.split(",") as JobProSource[];
      if (key === "--scope") options.scope = value as JobProScope;
      if (key === "--limit") options.limit = Number(value);
      if (key === "--start-page") options.startPage = Number(value);
      if (key === "--max-pages") options.maxPages = Number(value);
      if (key === "--max-jobs") options.maxJobs = Number(value);
      if (key === "--global-max-jobs") options.globalMaxJobs = Number(value);
    } else throw new Error("Unknown option");
  }
  if (!mode) throw new Error("Choose --dry-run or --write explicitly");
  bounds(options);
  return options;
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  let store: IngestionStore | undefined;
  if (!options.dryRun) {
    const { url, key } = serverConfig(process.env);
    store = createSourceStore(url, key);
  }
  const result = await runIngestion(options, { cli: invokeJobPro, store });
  console.log(JSON.stringify(result, null, 2));
  // Mixed source failures are isolated; lost audit records still require action.
  if (result.status === "failed" || result.sources.some((source) => source.audit_error)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("job-pro ingestion could not start. Check server-only Supabase configuration and options: --dry-run or --write, --sources <allowlisted companies>, --scope campus|intern, --limit 1–50, --max-pages 1–20, --start-page 1–20 (start-page + max-pages − 1 ≤ 20), --max-jobs 1–500, --global-max-jobs 1–500.");
    process.exitCode = 1;
  });
}
